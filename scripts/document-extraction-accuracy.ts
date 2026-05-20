import fs from "fs";
import path from "path";
import { detectExtractionSchema } from "@/lib/services/document-extraction-schemas";
import { extractDocumentResult } from "@/lib/services/document-extraction";
import { normalizedValuesMatch } from "@/lib/services/document-field-normalization";
import { inferExtractedDraftFields } from "@/lib/services/application-draft";
import { isCriticalExtractionFieldKey } from "@/lib/services/document-quality";

type Fixture = {
  fileName: string;
  mimeType: string;
  category: string;
  critical?: string[];
  fields: Record<string, string>;
};

type FieldResult = {
  label: string;
  expected: string;
  actual?: string;
  result: "exact_match" | "normalised_match" | "missing" | "mismatch";
  confidence?: number;
};

const fixturePath = path.join(process.cwd(), "scripts", "fixtures", "document-extraction", "expected-fields.json");
const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<string, Fixture>;

function makeDummyPdf(fixtureName: string, fixture: Fixture) {
  const lines = [
    "%PDF-1.4",
    "ARIA_FIXTURE_DOCUMENT: true",
    "ARIA_QUALITY=GOOD_QUALITY",
    `Document Type: ${fixtureName}`,
    ...Object.entries(fixture.fields).map(([key, value]) => `${key}: ${value}`),
    "Filler: This is dummy golden extraction text only. No real client data is present. ".repeat(18),
    "%%EOF"
  ];
  return Buffer.from(lines.join("\n"), "utf8");
}

function makeDummyImage(fixtureName: string, fixture: Fixture, quality: string) {
  const lines = [
    "ARIA_FIXTURE_DOCUMENT: true",
    `ARIA_QUALITY=${quality}`,
    `Document Type: ${fixtureName}`,
    ...Object.entries(fixture.fields).map(([key, value]) => `${key}: ${value}`),
    "Filler: Dummy phone photo OCR validation payload only. ".repeat(12)
  ];
  return Buffer.from(lines.join("\n"), "utf8");
}

function normaliseLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function keyValueIndex(keyValues: Array<{ key: string; value: string; confidence?: number }> = []) {
  const map = new Map<string, { key: string; value: string; confidence?: number }>();
  for (const field of keyValues) map.set(normaliseLabel(field.key), field);
  return map;
}

function compareFixtureFields(fixture: Fixture, keyValues: Array<{ key: string; value: string; confidence?: number }> = []) {
  const index = keyValueIndex(keyValues);
  const results: FieldResult[] = [];
  for (const [label, expected] of Object.entries(fixture.fields)) {
    const actual = index.get(normaliseLabel(label));
    const result = !actual
      ? "missing"
      : actual.value === expected
        ? "exact_match"
        : normalizedValuesMatch(label, actual.value, expected)
          ? "normalised_match"
          : "mismatch";
    results.push({ label, expected, actual: actual?.value, result, confidence: actual?.confidence });
  }
  return results;
}

function summarize(results: FieldResult[]) {
  return {
    exact: results.filter((item) => item.result === "exact_match").length,
    normalised: results.filter((item) => item.result === "normalised_match").length,
    missing: results.filter((item) => item.result === "missing").length,
    mismatched: results.filter((item) => item.result === "mismatch").length
  };
}

async function runFixture(name: string, fixture: Fixture) {
  const bytes = makeDummyPdf(name, fixture);
  const extraction = await extractDocumentResult(bytes, fixture.mimeType, fixture.fileName);
  const fieldResults = compareFixtureFields(fixture, extraction.keyValues);
  const schema = detectExtractionSchema(fixture.fileName, extraction.extractedText);
  const inferred = inferExtractedDraftFields({
    fileName: fixture.fileName,
    category: fixture.category,
    extractedText: extraction.extractedText,
    keyValues: extraction.keyValues,
    subclassCode: "500"
  });
  const sourceRefsMissing = inferred.filter((field) => !field.snippet).length;
  const criticalDraftFields = inferred.filter((field) => isCriticalExtractionFieldKey(field.key));

  return {
    name,
    fileName: fixture.fileName,
    schema: schema.schema,
    schemaSupported: schema.supported,
    qualityStatus: extraction.documentQuality?.status ?? "NOT_ASSESSED",
    qualityScore: extraction.documentQuality?.score ?? null,
    confidence: extraction.confidence,
    fieldResults,
    inferredCount: inferred.length,
    criticalDraftFieldCount: criticalDraftFields.length,
    sourceRefsMissing,
    passed:
      fieldResults.every((field) => field.result === "exact_match" || field.result === "normalised_match")
      && extraction.documentQuality?.status === "GOOD_QUALITY"
      && sourceRefsMissing === 0
  };
}

async function runImageChecks() {
  const passport = fixtures.passport;
  const goodImage = await extractDocumentResult(makeDummyImage("passport-image", passport, "ACCEPTABLE_WITH_REVIEW"), "image/jpeg", "golden-passport-phone-photo.jpg");
  const poorImage = await extractDocumentResult(makeDummyImage("passport-image", passport, "POOR_QUALITY_REUPLOAD_RECOMMENDED"), "image/jpeg", "blurry-cropped-passport-phone-photo.jpg");
  const unreadableImage = await extractDocumentResult(Buffer.from("not enough readable data", "utf8"), "image/png", "unreadable-phone-photo.png");
  return {
    goodImage: {
      status: goodImage.documentQuality?.status,
      confidence: goodImage.confidence,
      fields: compareFixtureFields(passport, goodImage.keyValues),
      passed: goodImage.documentQuality?.status === "ACCEPTABLE_WITH_REVIEW"
        && compareFixtureFields(passport, goodImage.keyValues).every((field) => field.result === "exact_match" || field.result === "normalised_match")
    },
    poorImage: {
      status: poorImage.documentQuality?.status,
      autofillCriticalFieldsAllowed: poorImage.documentQuality?.autofillCriticalFieldsAllowed,
      passed: poorImage.documentQuality?.status === "POOR_QUALITY_REUPLOAD_RECOMMENDED" && poorImage.documentQuality.autofillCriticalFieldsAllowed === false
    },
    unreadableImage: {
      status: unreadableImage.documentQuality?.status,
      autofillCriticalFieldsAllowed: unreadableImage.documentQuality?.autofillCriticalFieldsAllowed,
      passed: unreadableImage.documentQuality?.status === "UNREADABLE_REUPLOAD_REQUIRED" && unreadableImage.documentQuality.autofillCriticalFieldsAllowed === false
    }
  };
}

async function main() {
  const results = [];
  for (const [name, fixture] of Object.entries(fixtures)) {
    results.push(await runFixture(name, fixture));
  }

  const imageChecks = await runImageChecks();
  const totalFields = results.reduce((sum, item) => sum + item.fieldResults.length, 0);
  const aggregate = results.reduce((acc, item) => {
    const summary = summarize(item.fieldResults);
    acc.exact += summary.exact;
    acc.normalised += summary.normalised;
    acc.missing += summary.missing;
    acc.mismatched += summary.mismatched;
    acc.sourceRefsMissing += item.sourceRefsMissing;
    acc.lowConfidence += item.confidence < 0.5 ? 1 : 0;
    return acc;
  }, { exact: 0, normalised: 0, missing: 0, mismatched: 0, sourceRefsMissing: 0, lowConfidence: 0 });

  const failed = results.filter((item) => !item.passed);
  const imageFailures = Object.entries(imageChecks).filter(([, check]) => !check.passed);

  console.log("Document extraction accuracy harness");
  console.log(JSON.stringify({
    documentsTested: results.length,
    documentTypes: results.map((item) => item.name),
    totalFields,
    exactMatches: aggregate.exact,
    normalisedMatches: aggregate.normalised,
    missingFields: aggregate.missing,
    mismatchedFields: aggregate.mismatched,
    lowConfidenceDocuments: aggregate.lowConfidence,
    sourceReferenceFailures: aggregate.sourceRefsMissing,
    imageChecks,
    perDocument: results.map((item) => ({
      name: item.name,
      schema: item.schema,
      qualityStatus: item.qualityStatus,
      confidence: item.confidence,
      inferredCount: item.inferredCount,
      criticalDraftFieldCount: item.criticalDraftFieldCount,
      ...summarize(item.fieldResults),
      passed: item.passed
    }))
  }, null, 2));

  if (failed.length || imageFailures.length || aggregate.missing || aggregate.mismatched || aggregate.sourceRefsMissing) {
    console.error("Document extraction accuracy failed", {
      failedDocuments: failed.map((item) => item.name),
      imageFailures: imageFailures.map(([name]) => name),
      missingFields: aggregate.missing,
      mismatchedFields: aggregate.mismatched,
      sourceReferenceFailures: aggregate.sourceRefsMissing
    });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
