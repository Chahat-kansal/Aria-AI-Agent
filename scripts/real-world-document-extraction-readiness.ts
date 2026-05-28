import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractDocumentResult } from "@/lib/services/document-extraction";

type Case = {
  name: string;
  mimeType: string;
  build: () => Promise<Buffer> | Buffer;
  expectBlocked?: boolean;
};

async function makePdf(lines: string[]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 800;
  for (const line of lines) {
    page.drawText(line, { x: 42, y, size: 11, font, maxWidth: 510, lineHeight: 14 });
    y -= 14;
  }
  return Buffer.from(await pdf.save());
}

function makeImageFixture(lines: string[]) {
  return Buffer.from(lines.join("\n"), "utf8");
}

const cases: Case[] = [
  { name: "clean-passport-pdf", mimeType: "application/pdf", build: () => makePdf(["ARIA_FIXTURE_DOCUMENT: true", "Full Name: REALISTIC TEST PERSON", "Date of Birth: 10/01/1990", "Passport Number: T1234567", "Nationality: Testland"]) },
  { name: "visa-grant-pdf", mimeType: "application/pdf", build: () => makePdf(["ARIA_FIXTURE_DOCUMENT: true", "Visa Subclass: 500", "Visa Grant Number: GR 111222333", "Visa Grant Date: 10/02/2025"]) },
  { name: "coe-pdf", mimeType: "application/pdf", build: () => makePdf(["ARIA_FIXTURE_DOCUMENT: true", "COE Number: COE-555", "Provider: Aria Test University", "Course Name: Master of Dummy Data"]) },
  { name: "oshc-pdf", mimeType: "application/pdf", build: () => makePdf(["ARIA_FIXTURE_DOCUMENT: true", "OSHC Provider: Test Cover", "Policy Number: OVHC 123 456"]) },
  { name: "employment-contract-pdf", mimeType: "application/pdf", build: () => makePdf(["ARIA_FIXTURE_DOCUMENT: true", "Employer: Dummy Sponsor Pty Ltd", "Position: Analyst", "Salary: AUD 90000"]) },
  { name: "bank-statement-pdf", mimeType: "application/pdf", build: () => makePdf(["ARIA_FIXTURE_DOCUMENT: true", "Account Holder: REALISTIC TEST PERSON", "Available Funds: AUD 30000"]) },
  { name: "relationship-statement-pdf", mimeType: "application/pdf", build: () => makePdf(["ARIA_FIXTURE_DOCUMENT: true", "Relationship Statement: Manual review required", "Relationship Start Date: 01/01/2020"]) },
  { name: "form-888-style-pdf", mimeType: "application/pdf", build: () => makePdf(["ARIA_FIXTURE_DOCUMENT: true", "Witness Name: TEST WITNESS", "Relationship to Couple: Friend"]) },
  { name: "poor-quality-image", mimeType: "image/jpeg", build: () => makeImageFixture(["ARIA_FIXTURE_DOCUMENT: true", "ARIA_QUALITY=POOR_QUALITY_REUPLOAD_RECOMMENDED", "Passport Number: T1234567"]), expectBlocked: true },
  { name: "rotated-image", mimeType: "image/jpeg", build: () => makeImageFixture(["ARIA_FIXTURE_DOCUMENT: true", "ARIA_QUALITY=ACCEPTABLE_WITH_REVIEW", "rotated", "Passport Number: T1234567"]) },
  { name: "invalid-pdf", mimeType: "application/pdf", build: () => Buffer.from("%PDF-1.4\ninvalid\n%%EOF", "utf8"), expectBlocked: true }
];

async function main() {
  const previousFlag = process.env.ALLOW_FIXTURE_PDF_FALLBACK;
  process.env.ALLOW_FIXTURE_PDF_FALLBACK = "true";
  const results = [];
  for (const item of cases) {
    const bytes = await item.build();
    const extraction = await extractDocumentResult(bytes, item.mimeType, `${item.name}.${item.mimeType.includes("pdf") ? "pdf" : "jpg"}`);
    results.push({
      name: item.name,
      confidence: extraction.confidence,
      qualityStatus: extraction.documentQuality?.status ?? null,
      blocked: extraction.documentQuality?.autofillCriticalFieldsAllowed === false,
      warningCount: extraction.warnings.length,
      unsupported: extraction.warnings.some((warning) => warning.includes("unsupported_document_type"))
    });
  }
  if (previousFlag == null) delete process.env.ALLOW_FIXTURE_PDF_FALLBACK;
  else process.env.ALLOW_FIXTURE_PDF_FALLBACK = previousFlag;

  console.log(JSON.stringify({
    supportedDocsTested: cases.length,
    exactMatches: results.filter((item) => item.confidence >= 0.7 && !item.blocked).length,
    lowConfidenceCount: results.filter((item) => item.confidence < 0.5).length,
    blockedCount: results.filter((item) => item.blocked).length,
    unsupportedCount: results.filter((item) => item.unsupported).length,
    ocrConfigured: !!process.env.AWS_ACCESS_KEY_ID,
    perCase: results,
    productionReadinessNotes: [
      "Clean generated PDFs should parse through the normal PDF path.",
      "Poor or invalid documents should remain blocked from automatic mapping."
    ]
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
