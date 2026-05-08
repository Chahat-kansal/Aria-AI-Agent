import { DraftFieldStatus, FieldStatus } from "@prisma/client";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { extractDocumentResult } from "@/lib/services/document-extraction";
import { prepareMatterDocumentUpload, persistDocumentStorageObject } from "@/lib/services/storage";
import { inferExtractedDraftFields, uploadDocumentToMatter, getDraftReviewData, updateDraftFieldReview, mapDocumentsToDraft } from "@/lib/services/application-draft";
import { encryptJson, encryptString } from "@/lib/security/encryption";

const matterId = process.argv[2];

if (!matterId) {
  console.error("Usage: npm exec tsx scripts/review-dashboard-smoke.ts <matterId>");
  process.exit(1);
}

const dummyUploads = [
  {
    fileName: "dummy-passport.pdf",
    mimeType: "application/pdf",
    body: `
Passport
Full Name: Dummy Applicant
Date of Birth: 02 Aug 1999
Nationality: Indian
Passport Number: X7894485
Country of Birth: India
Place of Birth: New Delhi
Expiry Date: 14 Sep 2031
`.trim()
  },
  {
    fileName: "dummy-coe.pdf",
    mimeType: "application/pdf",
    body: `
Confirmation of Enrolment
Provider: Aria Institute of Technology
Course Name: Master of Information Technology
COE Number: COE-AU-500-123456
CRICOS Code: 12345A
Course Start: 15 Jul 2026
End Date: 20 Jul 2028
`.trim()
  },
  {
    fileName: "dummy-financial-capacity.pdf",
    mimeType: "application/pdf",
    body: `
Financial Capacity Statement
Available Funds: AUD 48,500
Funding Source: Parents savings
Sponsor Relationship: Parents
`.trim()
  },
  {
    fileName: "dummy-oshc.pdf",
    mimeType: "application/pdf",
    body: `
OSHC Certificate
OSHC Provider: Bupa
Policy Number: OSHC-2026-7788
OSHC Start: 01 Jul 2026
OSHC End: 31 Aug 2028
`.trim()
  }
];

async function createPdfBytes(text: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  const lines = text.split("\n");
  let y = 790;

  for (const line of lines) {
    page.drawText(line, {
      x: 48,
      y,
      size: 12,
      font
    });
    y -= 18;
  }

  return Buffer.from(await pdf.save());
}

function buildSeededExtraction(
  upload: { body: string },
  extraction: Awaited<ReturnType<typeof extractDocumentResult>>
) {
  if (extraction.extractedText.trim().length > 80 && extraction.confidence >= 0.6) {
    return extraction;
  }

  return {
    ...extraction,
    provider: "seeded-local-fixture",
    model: "fixture-pdf-text",
    extractedText: upload.body,
    extractedTextPreview: upload.body.slice(0, 1000),
    confidence: 0.96,
    warnings: [
      "Local smoke fixture provided seeded extracted text because the baseline PDF parser was weak on this generated test file."
    ],
    configured: true
  };
}

async function main() {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    include: {
      assignedToUser: true,
      workspace: true,
      client: true,
      documents: true
    }
  });

  if (!matter) {
    throw new Error(`Matter ${matterId} was not found.`);
  }

  const uploader = matter.assignedToUser ?? await prisma.user.findFirst({
    where: { workspaceId: matter.workspaceId, status: { not: "DISABLED" } },
    orderBy: { id: "asc" }
  });

  if (!uploader) {
    throw new Error("No active uploader user found for this workspace.");
  }

  const createdDocuments: string[] = [];

  for (const upload of dummyUploads) {
    const alreadyExists = matter.documents.find((document) => document.fileName === upload.fileName);
    if (alreadyExists) {
      const latestExtraction = await prisma.documentExtractionResult.findFirst({
        where: { documentId: alreadyExists.id },
        orderBy: { createdAt: "desc" }
      });

      if (latestExtraction) {
        const baselineExtraction = await extractDocumentResult(Buffer.from(upload.body, "utf8"), upload.mimeType);
        const extraction = buildSeededExtraction(upload, baselineExtraction);
        const inferred = inferExtractedDraftFields({
          fileName: upload.fileName,
          category: alreadyExists.category,
          extractedText: extraction.extractedText,
          keyValues: extraction.keyValues
        });

        await prisma.documentExtractionResult.update({
          where: { id: latestExtraction.id },
          data: {
            provider: extraction.provider,
            model: extraction.model,
            extractedJson: encryptJson({
              category: alreadyExists.category,
              fields: inferred,
              extractedTextPreview: extraction.extractedTextPreview,
              extractionConfidence: extraction.confidence,
              extractionWarnings: extraction.warnings,
              extractionConfigured: extraction.configured,
              keyValues: extraction.keyValues ?? [],
              reviewRequired: true
            })
          }
        });

        await prisma.extractedField.deleteMany({ where: { documentId: alreadyExists.id } });
        for (const field of inferred) {
          await prisma.extractedField.create({
            data: {
              matterId: matter.id,
              documentId: alreadyExists.id,
              fieldKey: field.key,
              fieldLabel: field.key.split(".").slice(-1)[0].replace(/_/g, " "),
              fieldValue: encryptString(field.value),
              confidence: field.confidence,
              sourceSnippet: encryptString(field.snippet),
              sourcePageRef: encryptString("seeded local smoke fixture"),
              status: field.confidence >= 0.75 ? FieldStatus.SUPPORTED : FieldStatus.NEEDS_REVIEW,
              needsReview: true
            }
          });
        }
      }

      continue;
    }

    const bytes = await createPdfBytes(upload.body);
    const baselineExtraction = await extractDocumentResult(bytes, upload.mimeType);
    const extraction = buildSeededExtraction(upload, baselineExtraction);
    const prepared = await prepareMatterDocumentUpload({
      workspaceId: matter.workspaceId,
      matterId: matter.id,
      fileName: upload.fileName,
      bytes,
      mimeType: upload.mimeType
    });

    const document = await uploadDocumentToMatter({
      matterId: matter.id,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      storageKey: prepared.storageKey,
      fileSize: prepared.fileSize,
      contentHash: prepared.contentHash,
      extractedText: extraction.extractedText,
      extractionMetadata: {
        provider: extraction.provider,
        model: extraction.model,
        confidence: extraction.confidence,
        warnings: extraction.warnings,
        configured: extraction.configured,
        keyValues: extraction.keyValues,
        extractedTextPreview: extraction.extractedTextPreview
      },
      uploadedByUserId: uploader.id
    });

    await persistDocumentStorageObject({ documentId: document.id, upload: prepared });
    createdDocuments.push(document.id);
  }

  let reviewData = await getDraftReviewData(matter.id);
  const field = reviewData.draft.fields.find((item: any) => item.templateField.fieldKey === "applicant.full_name");
  let verifiedValueBefore: string | null = null;
  let verifiedValueAfter: string | null = null;

  if (field?.value) {
    verifiedValueBefore = field.value;
    await updateDraftFieldReview({
      draftFieldId: field.id,
      status: DraftFieldStatus.VERIFIED,
      notes: "Dummy smoke verification"
    });
    await mapDocumentsToDraft(matter.id);
    reviewData = await getDraftReviewData(matter.id);
    const refreshed = reviewData.draft.fields.find((item: any) => item.id === field.id);
    verifiedValueAfter = refreshed?.value ?? null;
  }

  const evidenceBackedFields = reviewData.draft.fields
    .filter((item: any) => item.value && item.evidenceLinks.length)
    .map((item: any) => ({
      key: item.templateField.fieldKey,
      value: item.value,
      status: item.status,
      snippet: item.sourceSnippet || item.evidenceLinks[0]?.sourceSnippet || null
    }));

  const unsafeFieldsNeedingReview = reviewData.draft.fields
    .filter((item: any) => ["health.declarations", "character.declarations", "signature.client_signature", "statement.genuine_student"].includes(item.templateField.fieldKey) || item.templateField.label.toLowerCase().includes("declaration"))
    .map((item: any) => ({
      key: item.templateField.fieldKey,
      status: item.status,
      value: item.value
    }));

  console.log(JSON.stringify({
    matterId: matter.id,
    createdDocuments,
    documentCount: reviewData.matter.documents.length,
    readinessScore: reviewData.draft.readinessScore,
    evidenceBackedFields,
    verifiedValueBefore,
    verifiedValueAfter,
    verifiedFieldProtected: verifiedValueBefore ? verifiedValueBefore === verifiedValueAfter : null,
    unsafeFieldsNeedingReview
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
