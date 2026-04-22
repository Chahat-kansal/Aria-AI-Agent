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

function inferredFields(fileName: string, category: string, extractedText = "") {
  const lower = `${fileName} ${extractedText}`.toLowerCase();
  const fields: Array<{ key: string; value: string; confidence: number; snippet: string }> = [];
  const fullName = extractedText.match(/\b(?:name|full name)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i)?.[1];
  const passportNumber = extractedText.match(/\b(?:passport(?: number| no\.?)?)\s*[:\-]?\s*([A-Z0-9]{6,12})\b/i)?.[1];
  const coeNumber = extractedText.match(/\b(?:coe|confirmation of enrolment)\s*(?:number|no\.?)?\s*[:\-]?\s*([A-Z0-9-]{6,20})\b/i)?.[1];
  const provider = extractedText.match(/\b(?:provider|institution|university|college)\s*[:\-]\s*([A-Za-z0-9 &,'-]{4,80})/i)?.[1];
  const funds = extractedText.match(/\b(?:funds|balance|available funds)\s*[:\-]?\s*(?:AUD|A\$|\$)?\s*([0-9,]{4,})\b/i)?.[1];
  const oshc = extractedText.match(/\b(?:oshc|health insurance)\s*(?:provider)?\s*[:\-]?\s*([A-Za-z &'-]{3,80})/i)?.[1];

  if (category === "Identity") {
    fields.push(
      { key: "applicant.full_name", value: fullName ?? "Review against passport", confidence: fullName ? 0.86 : 0.62, snippet: findSnippet(extractedText, /(?:name|full name)/i, `Identity evidence from ${fileName}`) },
      { key: "applicant.passport_number", value: passportNumber ?? "Needs manual passport review", confidence: passportNumber ? 0.9 : 0.55, snippet: findSnippet(extractedText, /passport/i, `Passport reference detected in ${fileName}`) }
    );
  }
  if (category === "Education") {
    fields.push(
      { key: "study.provider", value: provider ?? "Education provider requires review", confidence: provider ? 0.82 : 0.6, snippet: findSnippet(extractedText, /provider|institution|university|college/i, `Provider evidence from ${fileName}`) },
      { key: "study.coe_number", value: coeNumber ?? (lower.includes("coe") ? "CoE reference present" : "Needs CoE review"), confidence: coeNumber ? 0.88 : 0.62, snippet: findSnippet(extractedText, /coe|confirmation of enrolment/i, `CoE evidence from ${fileName}`) }
    );
  }
  if (category === "Financial") {
    fields.push({ key: "financial.available_funds", value: funds ? `AUD ${funds}` : "Financial evidence uploaded", confidence: funds ? 0.8 : 0.62, snippet: findSnippet(extractedText, /funds|balance|available funds/i, `Financial evidence from ${fileName}`) });
  }
  if (category === "Health / Insurance") {
    fields.push({ key: "health.oshc_provider", value: oshc ?? "OSHC evidence uploaded", confidence: oshc ? 0.79 : 0.66, snippet: findSnippet(extractedText, /oshc|health insurance/i, `Health insurance evidence from ${fileName}`) });
  }
  if (category === "Statements / Declarations") {
    fields.push({ key: "statement.genuine_student", value: "true", confidence: 0.7, snippet: findSnippet(extractedText, /genuine|statement|declaration/i, `Statement/declaration evidence from ${fileName}`) });
  }

  return fields;
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
  uploadedByUserId: string;
}) {
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId } });
  const category = classifyDocument(input.fileName, input.extractedText);
  const extractedFields = inferredFields(input.fileName, category, input.extractedText);

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
      provider: "aria-ai-assisted-extraction",
      model: "configured-provider",
      extractedJson: { category, fields: extractedFields, extractedTextPreview: input.extractedText?.slice(0, 1000) ?? "", reviewRequired: true }
    }
  });

  for (const field of extractedFields) {
    await prisma.extractedField.create({
      data: {
        matterId: matter.id,
        documentId: document.id,
        fieldKey: field.key,
        fieldLabel: field.key.split(".").slice(-1)[0].replace(/_/g, " "),
        fieldValue: field.value,
        confidence: field.confidence,
        sourceSnippet: field.snippet,
        sourcePageRef: "document metadata",
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
  const extractedFields = await prisma.extractedField.findMany({
    where: { matterId },
    include: { document: true },
    orderBy: { createdAt: "desc" }
  });

  for (const draftField of draft.fields) {
    const templateField = draftField.templateField;
    const supporting = extractedFields.find((field) => field.fieldKey === templateField.fieldKey);
    if (!supporting) continue;

    const updated = await prisma.matterDraftField.update({
      where: { id: draftField.id },
      data: {
        value: supporting.fieldValue,
        confidence: supporting.confidence,
        sourceSnippet: supporting.sourceSnippet,
        sourcePageRef: supporting.sourcePageRef,
        status: draftStatusForConfidence(supporting.confidence)
      }
    });

    await prisma.matterDraftFieldEvidenceLink.create({
      data: {
        draftFieldId: updated.id,
        documentId: supporting.documentId,
        sourceSnippet: supporting.sourceSnippet,
        sourcePageRef: supporting.sourcePageRef,
        confidence: supporting.confidence
      }
    }).catch(() => null);
  }

  return validateSubclass500Draft(matterId);
}

export async function validateSubclass500Draft(matterId: string) {
  const reviewData = await getDraftReviewData(matterId);
  const { matter, template, draft } = reviewData;

  await prisma.validationIssue.deleteMany({
    where: { matterId, type: { startsWith: "Subclass 500" }, resolutionStatus: { in: [ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS] } }
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
    byKey.set(field.fieldKey, [...(byKey.get(field.fieldKey) ?? []), field]);
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
        await prisma.matterDraftField.update({ where: { id: draftField.id }, data: { status: DraftFieldStatus.CONFLICTING } });
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
  await prisma.matter.update({ where: { id: matterId }, data: { readinessScore } });

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
      manualOverride: input.manualOverride,
      notes: input.notes,
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
}) {
  return prisma.matterReviewRequest.create({
    data: {
      matterId: input.matterId,
      draftId: input.draftId,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      message: input.message,
      status: ReviewRequestStatus.SENT_TO_CLIENT,
      sentAt: new Date()
    }
  });
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

  return {
    matter,
    template,
    draft,
    packageFolders: buildPackageFolders(matter.documents),
    openIssues: matter.validationIssues.filter((issue) => issue.resolutionStatus !== ResolutionStatus.RESOLVED)
  };
}
