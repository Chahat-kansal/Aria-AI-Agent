import crypto from "crypto";
import {
  DraftFieldStatus,
  DraftStatus,
  ExtractionStatus,
  FieldStatus,
  IssueSeverity,
  ResolutionStatus,
  ReviewRequestStatus,
  ReviewStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSubclass500Template } from "@/lib/services/subclass-templates";
import { generateAriaAiResponse } from "@/lib/services/ai-provider";
import { buildClientLink } from "@/lib/services/client-workflows";
import { detectExtractionSchema } from "@/lib/services/document-extraction-schemas";
import { buildGroundedResponse, type AriaGroundedResponse } from "@/lib/services/aria-evidence";
import { decryptJson, decryptString, encryptJson, encryptString } from "@/lib/security/encryption";
import { hashPortalToken, shortHashPreview } from "@/lib/security/hash";

const packageFolders = [
  "Identity",
  "Travel",
  "Education",
  "Employment",
  "Financial",
  "Relationship",
  "Health / Insurance",
  "Statements / Declarations",
  "Forms",
  "Other Evidence"
];

function classifyDocument(fileName: string, extractedText = "") {
  const lower = `${fileName} ${extractedText}`.toLowerCase();
  if (lower.includes("passport") || lower.includes("identity")) return "Identity";
  if (lower.includes("coe") || lower.includes("enrol") || lower.includes("course")) return "Education";
  if (lower.includes("employment") || lower.includes("contract") || lower.includes("payslip")) return "Employment";
  if (lower.includes("bank") || lower.includes("fund") || lower.includes("financial")) return "Financial";
  if (lower.includes("oshc") || lower.includes("insurance") || lower.includes("health") || lower.includes("police")) return "Health / Insurance";
  if (lower.includes("relationship") || lower.includes("partner")) return "Relationship";
  if (lower.includes("statement") || lower.includes("declaration") || lower.includes("genuine")) return "Statements / Declarations";
  if (lower.includes("form")) return "Forms";
  if (lower.includes("visa") || lower.includes("travel")) return "Travel";
  return "Other Evidence";
}

function findSnippet(text: string, pattern: RegExp, fallback: string) {
  const match = text.match(pattern);
  if (!match?.index && match?.index !== 0) return fallback;
  return text.slice(Math.max(0, match.index - 80), Math.min(text.length, match.index + 180)).trim() || fallback;
}

function cleanExtractedValue(value: string | undefined | null) {
  if (!value) return null;
  return value
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, " ")
    .replace(/\s*[;,.]\s*$/, "")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLabelValue(text: string, labels: string[]) {
  for (const label of labels) {
    const inline = new RegExp(`\\b${escapeRegex(label)}\\s*[:\\-]\\s*([^\\n\\r]+)`, "i");
    const inlineMatch = text.match(inline);
    const inlineValue = cleanExtractedValue(inlineMatch?.[1]);
    if (inlineValue) return inlineValue;

    const nextLine = new RegExp(`\\b${escapeRegex(label)}\\s*[\\n\\r]+([^\\n\\r]+)`, "i");
    const nextLineMatch = text.match(nextLine);
    const nextLineValue = cleanExtractedValue(nextLineMatch?.[1]);
    if (nextLineValue) return nextLineValue;
  }

  return null;
}

function extractAmountValue(text: string, labels: string[]) {
  const raw = extractLabelValue(text, labels);
  if (!raw) return null;
  const amount = raw.match(/(?:AUD|A\$|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]{4,})/i)?.[1];
  return cleanExtractedValue(amount ?? raw);
}

function looksGenericDraftValue(value: string) {
  return /review|requires review|needs manual|evidence uploaded|reference present/i.test(value);
}

function candidateStrength(candidate: { value: string; confidence: number }) {
  return candidate.confidence + (looksGenericDraftValue(candidate.value) ? 0 : 0.25);
}

function strongerCandidate<T extends { value: string; confidence: number }>(current: T | null, next: T) {
  if (!current) return next;
  return candidateStrength(next) > candidateStrength(current) ? next : current;
}

function inferredFields(fileName: string, category: string, extractedText = "") {
  const lower = `${fileName} ${extractedText}`.toLowerCase();
  const fields: Array<{ key: string; value: string; confidence: number; snippet: string }> = [];

  const fullName = extractLabelValue(extractedText, ["Full Name", "Name", "Applicant Name", "Student Name", "Candidate Name"]);
  const dateOfBirth = extractLabelValue(extractedText, ["Date of Birth", "DOB", "Birth Date"]);
  const nationality = extractLabelValue(extractedText, ["Nationality", "Citizenship"]);
  const passportNumber = extractLabelValue(extractedText, ["Passport Number", "Passport No", "Passport"]);
  const coeNumber = extractLabelValue(extractedText, ["COE Number", "CoE Number", "Confirmation of Enrolment Number", "COE"]);
  const provider = extractLabelValue(extractedText, ["Provider", "Institution", "University", "College", "Provider Name"]);
  const courseName = extractLabelValue(extractedText, ["Course Name", "Course", "Program", "Qualification"]);
  const courseStart = extractLabelValue(extractedText, ["Course Start", "Start Date", "Commencement"]);
  const funds = extractAmountValue(extractedText, ["Available Funds", "Funds", "Balance", "Declared Funds"]);
  const oshc = extractLabelValue(extractedText, ["OSHC Provider", "Health Insurance Provider", "OSHC", "Health Insurance"]);

  if (category === "Identity") {
    fields.push(
      { key: "applicant.full_name", value: fullName ?? "Review against passport", confidence: fullName ? 0.96 : 0.62, snippet: findSnippet(extractedText, /(?:name|full name|applicant name)/i, `Identity evidence from ${fileName}`) },
      { key: "applicant.date_of_birth", value: dateOfBirth ?? "Needs manual DOB review", confidence: dateOfBirth ? 0.95 : 0.54, snippet: findSnippet(extractedText, /date of birth|dob|birth date/i, `Date of birth evidence from ${fileName}`) },
      { key: "applicant.nationality", value: nationality ?? "Needs manual nationality review", confidence: nationality ? 0.94 : 0.54, snippet: findSnippet(extractedText, /nationality|citizenship/i, `Nationality evidence from ${fileName}`) },
      { key: "applicant.passport_number", value: passportNumber ?? "Needs manual passport review", confidence: passportNumber ? 0.97 : 0.55, snippet: findSnippet(extractedText, /passport/i, `Passport reference detected in ${fileName}`) }
    );
  }

  if (category === "Education") {
    fields.push(
      { key: "study.provider", value: provider ?? "Education provider requires review", confidence: provider ? 0.95 : 0.6, snippet: findSnippet(extractedText, /provider|institution|university|college/i, `Provider evidence from ${fileName}`) },
      { key: "study.course_name", value: courseName ?? "Course name requires review", confidence: courseName ? 0.94 : 0.58, snippet: findSnippet(extractedText, /course|program|qualification/i, `Course evidence from ${fileName}`) },
      { key: "study.coe_number", value: coeNumber ?? (lower.includes("coe") ? "CoE reference present" : "Needs CoE review"), confidence: coeNumber ? 0.97 : 0.62, snippet: findSnippet(extractedText, /coe|confirmation of enrolment/i, `CoE evidence from ${fileName}`) },
      { key: "study.course_start_date", value: courseStart ?? "Course start requires review", confidence: courseStart ? 0.92 : 0.56, snippet: findSnippet(extractedText, /course start|start date|commencement/i, `Course start evidence from ${fileName}`) }
    );
  }

  if (category === "Financial") {
    fields.push({
      key: "financial.available_funds",
      value: funds ? `AUD ${funds}` : "Financial evidence uploaded",
      confidence: funds ? 0.95 : 0.62,
      snippet: findSnippet(extractedText, /funds|balance|available funds/i, `Financial evidence from ${fileName}`)
    });
  }

  if (category === "Health / Insurance") {
    fields.push({
      key: "health.oshc_provider",
      value: oshc ?? "OSHC evidence uploaded",
      confidence: oshc ? 0.94 : 0.66,
      snippet: findSnippet(extractedText, /oshc|health insurance/i, `Health insurance evidence from ${fileName}`)
    });
  }

  if (category === "Statements / Declarations") {
    fields.push({
      key: "statement.genuine_student",
      value: "true",
      confidence: 0.7,
      snippet: findSnippet(extractedText, /genuine|statement|declaration/i, `Statement/declaration evidence from ${fileName}`)
    });
  }

  return fields;
}

function normalizeKeyValueLabel(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferredFieldsFromKeyValues(
  fileName: string,
  category: string,
  keyValues: Array<{ key: string; value: string; confidence?: number }> = []
) {
  const normalized = keyValues.map((item) => ({
    ...item,
    key: normalizeKeyValueLabel(item.key),
    value: cleanExtractedValue(item.value) ?? ""
  })).filter((item) => item.value);

  const findValue = (...labels: string[]) =>
    normalized.find((item) => labels.some((label) => item.key.includes(normalizeKeyValueLabel(label))));

  const fullName = findValue("full name", "name", "applicant name", "student name", "candidate name");
  const dateOfBirth = findValue("date of birth", "dob", "birth date");
  const nationality = findValue("nationality", "citizenship");
  const passportNumber = findValue("passport number", "passport no", "passport");
  const coeNumber = findValue("coe number", "confirmation of enrolment number", "coe");
  const provider = findValue("provider", "provider name", "institution", "university", "college");
  const courseName = findValue("course name", "course", "program", "qualification");
  const courseStart = findValue("course start", "start date", "commencement");
  const funds = findValue("available funds", "funds", "balance", "declared funds");
  const oshc = findValue("oshc provider", "health insurance provider", "oshc", "health insurance");

  const textSummary = normalized.map((item) => `${item.key}: ${item.value}`).join("\n");
  const candidates: Array<{ key: string; value: string; confidence: number; snippet: string }> = [];

  const pushCandidate = (
    fieldKey: string,
    match: { value: string; confidence?: number } | undefined,
    fallback: string,
    pattern: RegExp
  ) => {
    if (!match?.value) return;
    candidates.push({
      key: fieldKey,
      value: match.value,
      confidence: Math.max(Number(match.confidence ?? 0.9), 0.88),
      snippet: findSnippet(textSummary, pattern, fallback)
    });
  };

  if (category === "Identity") {
    pushCandidate("applicant.full_name", fullName, `Identity evidence from ${fileName}`, /full name|name/i);
    pushCandidate("applicant.date_of_birth", dateOfBirth, `Date of birth evidence from ${fileName}`, /date of birth|dob|birth date/i);
    pushCandidate("applicant.nationality", nationality, `Nationality evidence from ${fileName}`, /nationality|citizenship/i);
    pushCandidate("applicant.passport_number", passportNumber, `Passport evidence from ${fileName}`, /passport/i);
  }

  if (category === "Education") {
    pushCandidate("study.provider", provider, `Provider evidence from ${fileName}`, /provider|institution|university|college/i);
    pushCandidate("study.course_name", courseName, `Course evidence from ${fileName}`, /course|program|qualification/i);
    pushCandidate("study.coe_number", coeNumber, `CoE evidence from ${fileName}`, /coe|confirmation of enrolment/i);
    pushCandidate("study.course_start_date", courseStart, `Course start evidence from ${fileName}`, /course start|start date|commencement/i);
  }

  if (category === "Financial" && funds?.value) {
    candidates.push({
      key: "financial.available_funds",
      value: funds.value.match(/^\d/) ? `AUD ${funds.value}` : funds.value,
      confidence: Math.max(Number(funds.confidence ?? 0.9), 0.88),
      snippet: findSnippet(textSummary, /funds|balance|available funds/i, `Financial evidence from ${fileName}`)
    });
  }

  if (category === "Health / Insurance") {
    pushCandidate("health.oshc_provider", oshc, `Health insurance evidence from ${fileName}`, /oshc|health insurance/i);
  }

  return candidates;
}

export function inferExtractedDraftFields(input: {
  fileName: string;
  category: string;
  extractedText?: string;
  keyValues?: Array<{ key: string; value: string; confidence?: number }>;
}) {
  const strongestByFieldKey = new Map<string, { key: string; value: string; confidence: number; snippet: string }>();
  const candidates = [
    ...inferredFields(input.fileName, input.category, input.extractedText ?? ""),
    ...inferredFieldsFromKeyValues(input.fileName, input.category, input.keyValues ?? [])
  ];

  for (const candidate of candidates) {
    strongestByFieldKey.set(
      candidate.key,
      strongerCandidate(strongestByFieldKey.get(candidate.key) ?? null, candidate)
    );
  }

  return [...strongestByFieldKey.values()];
}

function draftStatusForConfidence(confidence?: number | null): DraftFieldStatus {
  if (!confidence) return DraftFieldStatus.MISSING;
  if (confidence >= 0.92) return DraftFieldStatus.HIGH_CONFIDENCE;
  if (confidence >= 0.75) return DraftFieldStatus.SUPPORTED;
  return DraftFieldStatus.NEEDS_REVIEW;
}

export async function createOrGetSubclass500Draft(matterId: string): Promise<any> {
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: matterId } });
  const template = await getSubclass500Template(matter.workspaceId);

  const draft = await prisma.matterApplicationDraft.upsert({
    where: { matterId_templateId: { matterId, templateId: template.id } },
    create: {
      matterId,
      templateId: template.id,
      status: DraftStatus.DRAFTING
    },
    update: {}
  });

  for (const section of template.sections) {
    for (const templateField of section.fields) {
      await prisma.matterDraftField.upsert({
        where: { draftId_templateFieldId: { draftId: draft.id, templateFieldId: templateField.id } },
        create: {
          draftId: draft.id,
          templateFieldId: templateField.id,
          status: DraftFieldStatus.MISSING
        },
        update: {}
      });
    }
  }

  return getDraftReviewData(matterId);
}

export async function uploadDocumentToMatter(input: {
  matterId: string;
  fileName: string;
  mimeType?: string;
  storageKey?: string;
  fileSize?: number;
  contentHash?: string;
  extractedText?: string;
  extractionMetadata?: {
    provider?: string;
    model?: string;
    confidence?: number;
    warnings?: string[];
    configured?: boolean;
    keyValues?: Array<{ key: string; value: string; confidence?: number }>;
    extractedTextPreview?: string;
  };
  uploadedByUserId: string;
}) {
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId } });
  const category = classifyDocument(input.fileName, input.extractedText);
  const extractionSchema = detectExtractionSchema(input.fileName, input.extractedText);
  const extractedFields = inferExtractedDraftFields({
    fileName: input.fileName,
    category,
    extractedText: input.extractedText,
    keyValues: input.extractionMetadata?.keyValues
  });

  const document = await prisma.document.create({
    data: {
      workspaceId: matter.workspaceId,
      clientId: matter.clientId,
      matterId: matter.id,
      fileName: input.fileName,
      storageKey: input.storageKey ?? `matter/${matter.id}/${Date.now()}-${input.fileName}`,
      mimeType: input.mimeType ?? "application/octet-stream",
      fileSize: input.fileSize,
      contentHash: input.contentHash,
      category,
      uploadedByUserId: input.uploadedByUserId,
      extractionStatus: ExtractionStatus.QUEUED,
      reviewStatus: ReviewStatus.PENDING
    }
  });

  await prisma.documentExtractionResult.create({
    data: {
      documentId: document.id,
      provider: input.extractionMetadata?.provider ?? "aria-ai-assisted-extraction",
      model: input.extractionMetadata?.model ?? "configured-provider",
      extractedJson: encryptJson({
        category,
        fields: extractedFields,
        extractedTextPreview: input.extractionMetadata?.extractedTextPreview ?? input.extractedText?.slice(0, 1000) ?? "",
        extractionConfidence: input.extractionMetadata?.confidence ?? null,
        extractionWarnings: [
          ...(input.extractionMetadata?.warnings ?? []),
          ...(extractionSchema.supported ? [] : [extractionSchema.manualReviewReason ?? "Manual review required."])
        ],
        extractionSchema: extractionSchema.schema,
        extractionSchemaSupported: extractionSchema.supported,
        extractionConfigured: input.extractionMetadata?.configured ?? true,
        keyValues: input.extractionMetadata?.keyValues ?? [],
        reviewRequired: true
      })
    }
  });

  for (const field of extractedFields) {
    await prisma.extractedField.create({
      data: {
        matterId: matter.id,
        documentId: document.id,
        fieldKey: field.key,
        fieldLabel: field.key.split(".").slice(-1)[0].replace(/_/g, " "),
        fieldValue: encryptString(field.value),
        confidence: field.confidence,
        sourceSnippet: encryptString(field.snippet),
        sourcePageRef: encryptString("document metadata"),
        status: field.confidence >= 0.75 ? FieldStatus.SUPPORTED : FieldStatus.NEEDS_REVIEW,
        needsReview: true
      }
    });
  }

  await prisma.document.update({
    where: { id: document.id },
    data: { extractionStatus: ExtractionStatus.EXTRACTED }
  });

  await mapDocumentsToDraft(matter.id);
  return document;
}

export async function mapDocumentsToDraft(matterId: string) {
  const reviewData = await createOrGetSubclass500Draft(matterId);
  const draft = reviewData.draft;

  const documentsWithExtraction = await prisma.document.findMany({
    where: { matterId },
    include: {
      extractionResults: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      extractedFields: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  for (const document of documentsWithExtraction) {
    const latestExtraction = document.extractionResults[0];
    if (!latestExtraction) continue;

    const extractedPayload = decryptJson<{
      extractedTextPreview?: string;
      keyValues?: Array<{ key: string; value: string; confidence?: number }>;
    }>(String(latestExtraction.extractedJson));

    const previewText = [
      extractedPayload.extractedTextPreview ?? "",
      ...(extractedPayload.keyValues ?? []).map((item) => `${item.key}: ${item.value}`)
    ].join("\n");

    const derivedCandidates = inferExtractedDraftFields({
      fileName: document.fileName,
      category: document.category,
      extractedText: previewText,
      keyValues: extractedPayload.keyValues ?? []
    });

    for (const candidate of derivedCandidates) {
      const existing = document.extractedFields.find((field) => field.fieldKey === candidate.key);
      const existingValue = existing ? readSensitive(existing.fieldValue) ?? "" : "";
      const shouldWrite =
        !existing
        || looksGenericDraftValue(existingValue)
        || candidateStrength({ value: candidate.value, confidence: candidate.confidence }) > candidateStrength({ value: existingValue, confidence: existing.confidence ?? 0 });

      if (!shouldWrite) continue;

      if (existing) {
        await prisma.extractedField.update({
          where: { id: existing.id },
          data: {
            fieldLabel: candidate.key.split(".").slice(-1)[0].replace(/_/g, " "),
            fieldValue: encryptString(candidate.value),
            confidence: candidate.confidence,
            sourceSnippet: encryptString(candidate.snippet),
            sourcePageRef: encryptString("document metadata"),
            status: candidate.confidence >= 0.75 ? FieldStatus.SUPPORTED : FieldStatus.NEEDS_REVIEW,
            needsReview: true
          }
        });
      } else {
        await prisma.extractedField.create({
          data: {
            matterId,
            documentId: document.id,
            fieldKey: candidate.key,
            fieldLabel: candidate.key.split(".").slice(-1)[0].replace(/_/g, " "),
            fieldValue: encryptString(candidate.value),
            confidence: candidate.confidence,
            sourceSnippet: encryptString(candidate.snippet),
            sourcePageRef: encryptString("document metadata"),
            status: candidate.confidence >= 0.75 ? FieldStatus.SUPPORTED : FieldStatus.NEEDS_REVIEW,
            needsReview: true
          }
        });
      }
    }
  }

  const extractedFields = await prisma.extractedField.findMany({
    where: { matterId },
    include: { document: true },
    orderBy: { createdAt: "desc" }
  });
  const decryptedExtractedFields = extractedFields.map((field) => ({
    ...field,
    fieldValue: readSensitive(field.fieldValue) ?? "",
    sourceSnippet: readSensitive(field.sourceSnippet) ?? "",
    sourcePageRef: readSensitive(field.sourcePageRef) ?? ""
  }));

  const bestSupportByFieldKey = new Map<string, typeof decryptedExtractedFields[number]>();
  const validDocumentIds = new Set(decryptedExtractedFields.map((field) => field.documentId));
  for (const field of decryptedExtractedFields) {
    const current = bestSupportByFieldKey.get(field.fieldKey) ?? null;
    const nextScore = candidateStrength({ value: field.fieldValue, confidence: field.confidence ?? 0 });
    const currentScore = current ? candidateStrength({ value: current.fieldValue, confidence: current.confidence ?? 0 }) : -1;
    if (!current || nextScore > currentScore) {
      bestSupportByFieldKey.set(field.fieldKey, field);
    }
  }

  for (const draftField of draft.fields) {
    const templateField = draftField.templateField;
    const supporting = bestSupportByFieldKey.get(templateField.fieldKey);
    if (!supporting) continue;
    if (draftField.status === DraftFieldStatus.VERIFIED) continue;

    const updated = await prisma.matterDraftField.update({
      where: { id: draftField.id },
      data: {
        value: encryptString(supporting.fieldValue),
        confidence: supporting.confidence,
        sourceSnippet: encryptString(supporting.sourceSnippet),
        sourcePageRef: encryptString(supporting.sourcePageRef),
        status: draftStatusForConfidence(supporting.confidence)
      }
    });

    if (validDocumentIds.has(supporting.documentId)) {
      await prisma.matterDraftFieldEvidenceLink.create({
        data: {
          draftFieldId: updated.id,
          documentId: supporting.documentId,
          sourceSnippet: encryptString(supporting.sourceSnippet),
          sourcePageRef: encryptString(supporting.sourcePageRef),
          confidence: supporting.confidence
        }
      }).catch(() => null);
    }
  }

  const aiSuggestions = await generateAriaAiResponse({
    system: `
You are Aria, an AI migration workbench assisting a registered migration agent.

Map extracted evidence into visa draft fields.

Rules:
- Do not invent values.
- Use only supplied extracted fields and snippets.
- If unsure, mark needs review.
- Never overwrite verified fields.
- Return strict JSON:
{
  "fieldSuggestions": [
    {
      "fieldKey": string,
      "value": string,
      "confidence": number,
      "sourceSnippet": string,
      "sourceDocumentId": string,
      "reasoning": string
    }
  ]
}
`,
    user: "Suggest draft field mappings for this visa application.",
    context: {
      matterId,
      draftFields: draft.fields.map((field: any) => ({
        id: field.id,
        fieldKey: field.templateField.fieldKey,
        label: field.templateField.label,
        currentValue: field.value,
        currentStatus: field.status
      })),
      extractedFields: decryptedExtractedFields.map((field) => ({
        documentId: field.documentId,
        documentName: field.document.fileName,
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        fieldValue: field.fieldValue,
        confidence: field.confidence,
        sourceSnippet: field.sourceSnippet
      }))
    }
  }).catch(() => null);

  if (aiSuggestions?.fieldSuggestions && Array.isArray(aiSuggestions.fieldSuggestions)) {
    for (const suggestion of aiSuggestions.fieldSuggestions) {
      if (!suggestion.fieldKey || !suggestion.value) continue;

      const draftField = draft.fields.find(
        (field: any) => field.templateField.fieldKey === suggestion.fieldKey
      );

      if (!draftField) continue;
      if (draftField.status === DraftFieldStatus.VERIFIED) continue;

      const confidence = Number(suggestion.confidence || 0.65);

      const updated = await prisma.matterDraftField.update({
        where: { id: draftField.id },
        data: {
          value: encryptString(String(suggestion.value)),
          confidence,
          sourceSnippet: encryptString(String(suggestion.sourceSnippet || "")),
          sourcePageRef: encryptString("AI-assisted evidence mapping"),
          status: draftStatusForConfidence(confidence)
        }
      });

      if (suggestion.sourceDocumentId && validDocumentIds.has(String(suggestion.sourceDocumentId))) {
        await prisma.matterDraftFieldEvidenceLink.create({
          data: {
            draftFieldId: updated.id,
            documentId: String(suggestion.sourceDocumentId),
            sourceSnippet: encryptString(String(suggestion.sourceSnippet || "")),
            sourcePageRef: encryptString("AI-assisted evidence mapping"),
            confidence
          }
        }).catch(() => null);
      }
    }
  }

  return validateSubclass500Draft(matterId);
}

export async function buildDraftAutofillGroundedResponse(matterId: string): Promise<AriaGroundedResponse> {
  const reviewData = await getDraftReviewData(matterId);
  const fieldsNeedingReview = reviewData.draft.fields.filter((field: any) =>
    [DraftFieldStatus.NEEDS_REVIEW, DraftFieldStatus.CONFLICTING, DraftFieldStatus.MISSING].includes(field.status)
  );
  const supportedFields = reviewData.draft.fields.filter((field: any) => field.value || field.manualOverride);

  return buildGroundedResponse({
    answer: `Draft autofill reviewed ${supportedFields.length} mapped field(s) for this matter. Registered migration agent review is still required before any field is used in client-facing or submission-preparation work.`,
    evidence: supportedFields.slice(0, 8).map((field: any) => ({
      sourceType: "DRAFT_FIELD",
      sourceId: field.id,
      title: field.templateField.label,
      snippet: field.sourceSnippet || field.evidenceLinks[0]?.sourceSnippet || "No stored source snippet.",
      confidence: field.confidence ?? undefined,
      reliability: field.evidenceLinks.length ? "AI_EXTRACTED" : "SYSTEM_DERIVED"
    })),
    assumptions: ["Only currently accessible matter, extracted field, and evidence-link records were used."],
    missingInformation: fieldsNeedingReview.slice(0, 10).map((field: any) => field.templateField.label),
    confidence: 0.74,
    recommendedActions: [
      "Verify all identifiers, dates, and declarations against the original uploaded evidence.",
      "Resolve missing or conflicting fields before treating the draft as complete.",
      "Run the final cross-check before client review or submission preparation."
    ],
    warnings: [
      "Declaration, health, criminal, and signature fields should never be guessed.",
      "Verified fields are preserved, but agent review is still required for every suggested value."
    ]
  });
}

export async function validateSubclass500Draft(matterId: string) {
  const reviewData = await getDraftReviewData(matterId);
  const { matter, template, draft } = reviewData;

  await prisma.validationIssue.deleteMany({
    where: {
      matterId,
      type: { startsWith: "Subclass 500" },
      resolutionStatus: { in: [ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS] }
    }
  });

  const requiredFields = template.sections.flatMap((section: any) => section.fields).filter((field: any) => field.required);
  const templateFieldKeys = new Set(template.sections.flatMap((section: any) => section.fields).map((field: any) => field.fieldKey));
  const draftFieldsByTemplateId = new Map<string, any>(draft.fields.map((field: any) => [field.templateFieldId, field]));
  const openIssues: Array<{ title: string; description: string; severity: IssueSeverity; relatedFieldKey?: string }> = [];

  for (const field of requiredFields) {
    const draftField = draftFieldsByTemplateId.get(field.id);
    if (!draftField?.value || draftField.status === DraftFieldStatus.MISSING) {
      openIssues.push({
        title: `Missing ${field.label}`,
        description: `${field.label} is required for the Subclass 500 draft and does not have reliable source-linked evidence yet.`,
        severity: IssueSeverity.HIGH,
        relatedFieldKey: field.fieldKey
      });
    } else if ([DraftFieldStatus.NEEDS_REVIEW, DraftFieldStatus.CONFLICTING].includes(draftField.status)) {
      openIssues.push({
        title: `${field.label} requires review`,
        description: `${field.label} has a draft value but still needs migration agent review before client confirmation.`,
        severity: IssueSeverity.MEDIUM,
        relatedFieldKey: field.fieldKey
      });
    }
  }

  const documentCategories = new Set(matter.documents.map((document: any) => document.category));

  for (const requirement of template.requirements.filter((item: any) => item.required)) {
    if (!documentCategories.has(requirement.category)) {
      openIssues.push({
        title: `Missing ${requirement.label}`,
        description: requirement.description,
        severity: IssueSeverity.HIGH
      });
    }
  }

  const extractedFields = await prisma.extractedField.findMany({ where: { matterId } });
  const byKey = new Map<string, typeof extractedFields>();

  for (const field of extractedFields) {
    const hydratedField = {
      ...field,
      fieldValue: readSensitive(field.fieldValue) ?? "",
      sourceSnippet: readSensitive(field.sourceSnippet) ?? ""
    };
    byKey.set(field.fieldKey, [...(byKey.get(field.fieldKey) ?? []), hydratedField as typeof field]);

    if (!templateFieldKeys.has(field.fieldKey)) {
      openIssues.push({
        title: `Unsupported extracted field: ${field.fieldLabel}`,
        description: `${field.fieldLabel} was extracted but is not mapped to the current Subclass 500 template. Review whether it belongs in notes or supporting evidence.`,
        severity: IssueSeverity.LOW,
        relatedFieldKey: field.fieldKey
      });
    }
  }

  for (const [fieldKey, fields] of byKey.entries()) {
    const values = new Set(fields.map((field) => field.fieldValue.trim().toLowerCase()).filter(Boolean));

    if (values.size > 1) {
      openIssues.push({
        title: `Conflicting values for ${fieldKey}`,
        description: `Multiple uploaded documents support different values for ${fieldKey}. Review the linked source snippets before client confirmation.`,
        severity: IssueSeverity.HIGH,
        relatedFieldKey: fieldKey
      });

      const draftField = draft.fields.find((field: any) => field.templateField.fieldKey === fieldKey);
      if (draftField) {
        await prisma.matterDraftField.update({
          where: { id: draftField.id },
          data: { status: DraftFieldStatus.CONFLICTING }
        });
      }
    }
  }

  await Promise.all(
    openIssues.map((issue) =>
      prisma.validationIssue.create({
        data: {
          matterId,
          severity: issue.severity,
          type: "Subclass 500 validation",
          title: issue.title,
          description: issue.description,
          relatedFieldKey: issue.relatedFieldKey,
          resolutionStatus: ResolutionStatus.OPEN
        }
      })
    )
  );

  const totalChecks = requiredFields.length + template.requirements.filter((item: any) => item.required).length;
  const readinessScore = Math.max(0, Math.round(((totalChecks - openIssues.length) / Math.max(totalChecks, 1)) * 100));
  const status = openIssues.length === 0 ? DraftStatus.READY_FOR_AGENT_REVIEW : DraftStatus.NEEDS_WORK;

  await prisma.matterApplicationDraft.update({
    where: { id: draft.id },
    data: { readinessScore, status }
  });

  await prisma.matter.update({
    where: { id: matterId },
    data: { readinessScore }
  });

  return getDraftReviewData(matterId);
}

export async function updateDraftFieldReview(input: {
  draftFieldId: string;
  status: DraftFieldStatus;
  manualOverride?: string;
  notes?: string;
}) {
  const field = await prisma.matterDraftField.update({
    where: { id: input.draftFieldId },
    data: {
      status: input.status,
      manualOverride: input.manualOverride ? encryptString(input.manualOverride) : undefined,
      notes: input.notes ? encryptString(input.notes) : undefined,
      reviewedAt: new Date(),
      verifiedAt: input.status === DraftFieldStatus.VERIFIED ? new Date() : undefined
    },
    include: { draft: true }
  });

  await validateSubclass500Draft(field.draft.matterId);
  return field;
}

export async function createClientReviewRequest(input: {
  matterId: string;
  draftId: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  requestOrigin?: string | null;
}) {
  const publicToken = crypto.randomBytes(32).toString("base64url");
  const request = await prisma.matterReviewRequest.create({
    data: {
      matterId: input.matterId,
      draftId: input.draftId,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      message: input.message ? encryptString(input.message) : undefined,
      publicTokenHash: hashPortalToken(publicToken),
      publicTokenPreview: shortHashPreview(publicToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      status: ReviewRequestStatus.SENT_TO_CLIENT,
      sentAt: new Date()
    }
  });
  return {
    request,
    reviewUrl: buildClientLink("/client-review", publicToken, input.requestOrigin)
  };
}

function readSensitive(value: string | null | undefined) {
  return value ? decryptString(value) : value;
}

export function buildPackageFolders(documents: Array<{ id: string; fileName: string; category: string; reviewStatus: ReviewStatus }>) {
  return packageFolders.map((folder) => ({
    folder,
    documents: documents.filter((document) => document.category === folder),
    required: ["Identity", "Education", "Financial", "Health / Insurance", "Statements / Declarations"].includes(folder)
  }));
}

export async function getDraftReviewData(matterId: string): Promise<any> {
  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: {
      client: true,
      documents: { orderBy: { createdAt: "desc" } },
      validationIssues: { orderBy: [{ severity: "desc" }, { createdAt: "desc" }] }
    }
  });

  const template = await getSubclass500Template(matter.workspaceId);

  const draft = await prisma.matterApplicationDraft.findUnique({
    where: { matterId_templateId: { matterId, templateId: template.id } },
    include: {
      fields: {
        include: {
          templateField: { include: { section: true } },
          evidenceLinks: { include: { document: true } }
        },
        orderBy: { templateField: { sortOrder: "asc" } }
      },
      reviewRequests: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!draft) {
    return createOrGetSubclass500Draft(matterId);
  }

  const hydratedDraft = {
    ...draft,
    fields: draft.fields.map((field) => ({
      ...field,
      value: readSensitive(field.value),
      sourceSnippet: readSensitive(field.sourceSnippet),
      sourcePageRef: readSensitive(field.sourcePageRef),
      manualOverride: readSensitive(field.manualOverride),
      notes: readSensitive(field.notes),
      evidenceLinks: field.evidenceLinks.map((link) => ({
        ...link,
        sourceSnippet: readSensitive(link.sourceSnippet),
        sourcePageRef: readSensitive(link.sourcePageRef)
      }))
    })),
    reviewRequests: draft.reviewRequests.map((request) => ({
      ...request,
      message: readSensitive(request.message)
    }))
  };

  return {
    matter,
    template,
    draft: hydratedDraft,
    packageFolders: buildPackageFolders(matter.documents),
    openIssues: matter.validationIssues.filter((issue) => issue.resolutionStatus !== ResolutionStatus.RESOLVED)
  };
}
