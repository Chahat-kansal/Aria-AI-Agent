import { DraftFieldStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDraftReviewData } from "@/lib/services/application-draft";
import { assessMatterCaseSafety } from "@/lib/services/case-safety";
import { buildMatterClientConfirmationItems } from "@/lib/services/client-confirmation";
import { getFullApplicationDraftTemplate } from "@/lib/templates/application-drafts";
import type {
  FullApplicationDraft,
  FullApplicationDraftTemplate,
  FullDraftContext,
  FullDraftDocumentRequirementResult,
  FullDraftField,
  FullDraftFieldTemplate,
  FullDraftMarker
} from "@/lib/services/full-application-draft-types";

export const FULL_APPLICATION_DRAFT_DISCLAIMER =
  "AI-assisted staff review draft. Registered migration agent review required before use. Aria does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications.";

const approvedDraftStatuses = new Set<string>([
  DraftFieldStatus.VERIFIED,
  DraftFieldStatus.HIGH_CONFIDENCE,
  DraftFieldStatus.SUPPORTED
]);

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function displayValue(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function markerLabel(marker: FullDraftMarker) {
  return `[${marker.replaceAll("_", " ")}]`;
}

function getMatterFallback(context: FullDraftContext, key: string) {
  const fullName = `${context.client.firstName} ${context.client.lastName}`.trim();
  const map: Record<string, string> = {
    "matter.visaSubclass": context.matter.visaSubclass,
    "matter.visaStream": context.matter.visaStream ?? "",
    "matter.stage": context.matter.stage ?? "",
    "matter.status": context.matter.status ?? "",
    "applicant.full_name": fullName,
    "applicant.date_of_birth": displayValue(context.client.dob),
    "applicant.nationality": context.client.nationality ?? "",
    "contact.email": context.client.email ?? "",
    "contact.phone": context.client.phone ?? "",
    "visa.current_visa_subclass": context.matter.currentVisaStatus ?? context.client.currentVisaStatus ?? "",
    "visa.expiry_date": displayValue(context.matter.currentVisaExpiry ?? context.client.currentVisaExpiry),
    "workspace.organisation": context.workspace.legalName ?? context.workspace.name,
    "workspace.email": context.workspace.contactEmail ?? "",
    "workspace.phone": context.workspace.contactPhone ?? "",
    "workspace.address": context.workspace.address ?? "",
    "agent.name": context.agent?.name ?? "",
    "agent.marn": extractMarn(context.agent?.notes ?? context.agent?.jobTitle ?? ""),
  };
  return map[key] ?? "";
}

function extractMarn(value: string) {
  const match = value.match(/\bMARN\s*[:#-]?\s*([0-9]{5,})\b/i);
  return match?.[1] ?? "";
}

function confidenceLabel(confidence?: number | null) {
  if (confidence == null) return undefined;
  return Math.round(confidence * 100) / 100;
}

function buildMissingField(field: FullDraftFieldTemplate, reason: "missing" | "unsafe" | "conflicting" = "missing"): FullDraftField {
  const markers: FullDraftMarker[] =
    reason === "unsafe"
      ? ["UNSAFE_TO_AUTOFILL", "CLIENT_CONFIRMATION_REQUIRED", "AGENT_REVIEW_REQUIRED"]
      : reason === "conflicting"
        ? ["CONFLICTING_EVIDENCE", "AGENT_REVIEW_REQUIRED"]
        : ["MISSING", "NOT_FOUND_IN_APPROVED_EVIDENCE", "SOURCE_REQUIRED"];

  if (field.agentNarrative && !markers.includes("AGENT_TO_INSERT_NARRATIVE")) markers.push("AGENT_TO_INSERT_NARRATIVE");
  if (field.manualReview && !markers.includes("MANUAL_REVIEW_REQUIRED")) markers.push("MANUAL_REVIEW_REQUIRED");
  if (field.onlineOnly && !markers.includes("OFFICIAL_FORM_ONLINE_ONLY")) markers.push("OFFICIAL_FORM_ONLINE_ONLY");
  if (field.clientConfirmationCategory && !markers.includes("CLIENT_CONFIRMATION_REQUIRED")) markers.push("CLIENT_CONFIRMATION_REQUIRED");

  return {
    key: field.key,
    label: field.label,
    value: markers.map(markerLabel).join(" "),
    sourceType: "Not found in approved evidence",
    status: reason === "conflicting" ? "CONFLICTING_EVIDENCE" : "MISSING",
    markers
  };
}

function buildField(field: FullDraftFieldTemplate, context: FullDraftContext): FullDraftField {
  const draftField = context.draftFields.find((item) => item.key === field.key);

  if (field.unsafe && draftField?.status !== DraftFieldStatus.VERIFIED) {
    return buildMissingField(field, "unsafe");
  }

  if (draftField?.status === DraftFieldStatus.CONFLICTING) {
    return buildMissingField(field, "conflicting");
  }

  const rawDraftValue = draftField?.manualOverride || draftField?.value || "";
  const isApprovedDraftValue = draftField && approvedDraftStatuses.has(draftField.status) && rawDraftValue;

  if (isApprovedDraftValue) {
    const markers: FullDraftMarker[] = draftField.status === DraftFieldStatus.VERIFIED
      ? ["VERIFIED", "APPROVED_FOR_AI"]
      : ["APPROVED_FOR_AI", "AGENT_REVIEW_REQUIRED"];
    if (field.clientConfirmationCategory) markers.push("CLIENT_CONFIRMATION_REQUIRED");
    if (field.agentNarrative) markers.push("AGENT_TO_INSERT_NARRATIVE");

    return {
      key: field.key,
      label: field.label,
      value: rawDraftValue,
      sourceDocument: draftField.sourceDocument || undefined,
      sourceType: draftField.status === DraftFieldStatus.VERIFIED ? "Verified draft field" : "Approved AI Working Copy field",
      sourceReference: draftField.sourcePageRef || draftField.sourceSnippet || undefined,
      confidence: confidenceLabel(draftField.confidence),
      status: draftField.status,
      markers
    };
  }

  const fallbackValue = getMatterFallback(context, field.key);
  if (fallbackValue) {
    const markers: FullDraftMarker[] = ["AGENT_REVIEW_REQUIRED"];
    if (field.sourceRequired) markers.push("SOURCE_REQUIRED");
    if (field.clientConfirmationCategory) markers.push("CLIENT_CONFIRMATION_REQUIRED");
    if (field.manualReview) markers.push("MANUAL_REVIEW_REQUIRED");
    if (field.onlineOnly) markers.push("OFFICIAL_FORM_ONLINE_ONLY");
    return {
      key: field.key,
      label: field.label,
      value: fallbackValue,
      sourceType: field.fallback ? `${field.fallback} metadata` : "Matter metadata",
      status: field.sourceRequired ? "SOURCE_REQUIRED" : "METADATA",
      markers
    };
  }

  return buildMissingField(field);
}

function documentMatches(requirement: FullApplicationDraftTemplate["documentRequirements"][number], document: FullDraftContext["documents"][number]) {
  const haystack = `${document.fileName} ${document.category}`.toLowerCase();
  return document.category === requirement.category || requirement.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function buildDocumentMatrix(template: FullApplicationDraftTemplate, context: FullDraftContext): FullDraftDocumentRequirementResult[] {
  return template.documentRequirements.map((requirement) => {
    const matchedDocuments = context.documents.filter((document) => documentMatches(requirement, document));
    const extracted = matchedDocuments.some((document) => document.extractionStatus === "EXTRACTED");
    const approvedForAiWorkingCopy = context.draftFields.some((field) =>
      approvedDraftStatuses.has(field.status)
      && matchedDocuments.some((document) => field.sourceDocument === document.fileName)
    );
    return {
      ...requirement,
      uploaded: matchedDocuments.length > 0,
      extracted,
      approvedForAiWorkingCopy,
      clientConfirmationRequired: Boolean(requirement.clientConfirmationCategory),
      matchedDocuments
    };
  });
}

function buildActionFlags(draft: FullApplicationDraft) {
  const missingCritical = draft.documentMatrix
    .filter((item) => item.status === "REQUIRED" && !item.uploaded)
    .map((item) => ({
      severity: "hard" as const,
      title: `Missing required document: ${item.label}`,
      detail: item.description ?? "Required evidence has not been linked to this matter."
    }));

  const missingFields = draft.sections
    .flatMap((section) => section.fields)
    .filter((field) => field.markers.includes("MISSING") || field.markers.includes("CLIENT_CONFIRMATION_REQUIRED") || field.markers.includes("CONFLICTING_EVIDENCE"))
    .slice(0, 12)
    .map((field) => ({
      severity: field.markers.includes("CONFLICTING_EVIDENCE") ? "hard" as const : "soft" as const,
      title: field.label,
      detail: field.markers.map(markerLabel).join(" ")
    }));

  return [...missingCritical, ...missingFields];
}

export function buildFullApplicationDraftFromContext(context: FullDraftContext): FullApplicationDraft {
  const template = getFullApplicationDraftTemplate(context.matter.visaSubclass);
  if (!template) {
    return {
      matterId: context.matter.id,
      title: "Full Application Draft",
      supportLevel: "NOT_CONFIGURED",
      supportNotes: "No configured full draft or checklist workflow is available for this subclass.",
      generatedAt: new Date().toISOString(),
      generatedBy: context.agent?.name || "Aria",
      canGenerate: false,
      notEnoughEvidenceReason: "This subclass does not have a configured full application draft template.",
      disclaimer: FULL_APPLICATION_DRAFT_DISCLAIMER,
      cover: [],
      actionFlags: [],
      documentMatrix: [],
      sections: [],
      safety: {
        status: "Blocked - missing critical evidence",
        hardBlockers: ["No full draft template configured."],
        softBlockers: [],
        recommendedActions: ["Use checklist and draft pack workflow until a full draft template is configured."]
      }
    };
  }

  const documentMatrix = buildDocumentMatrix(template, context);
  const sections = template.sections.map((section) => ({
    key: section.key,
    title: section.title,
    description: section.description,
    fields: section.fields.map((field) => buildField(field, context))
  }));
  const cover = [
    { label: "Firm / workspace", value: context.workspace.legalName ?? context.workspace.name },
    { label: "Matter reference", value: context.matter.reference ?? context.matter.id },
    { label: "Visa subclass", value: `Subclass ${context.matter.visaSubclass}` },
    { label: "Stream", value: context.matter.visaStream ?? "Not set" },
    { label: "Applicant", value: `${context.client.firstName} ${context.client.lastName}`.trim() },
    { label: "Generated date", value: formatDate(new Date()) },
    { label: "Generated by", value: context.agent?.name ?? "Aria" },
    { label: "Assigned agent", value: context.agent?.name ?? "Not set" },
    { label: "Agent MARN", value: extractMarn(context.agent?.notes ?? context.agent?.jobTitle ?? "") || "[SOURCE REQUIRED]" },
    { label: "Document count", value: String(context.documents.length) },
    { label: "Approved field count", value: String(context.draftFields.filter((field) => approvedDraftStatuses.has(field.status)).length) },
    { label: "Review status", value: `${context.matter.readinessScore ?? 0}% ready - agent review required` },
    { label: "Safety status", value: context.safety?.readyForAgentFinalReview ? "Ready for agent final review" : "Blocked - missing critical evidence" }
  ];

  const canGenerate = context.draftFields.some((field) => approvedDraftStatuses.has(field.status))
    || context.documents.some((document) => document.extractionStatus === "EXTRACTED")
    || documentMatrix.some((item) => item.uploaded);

  const safety = {
    status: context.safety?.readyForAgentFinalReview ? "Ready for agent final review" as const : "Blocked - missing critical evidence" as const,
    hardBlockers: context.safety?.hardBlockers.map((blocker) => blocker.title) ?? [],
    softBlockers: context.safety?.softBlockers.map((blocker) => blocker.title) ?? [],
    recommendedActions: context.safety?.recommendedActions ?? []
  };

  const draft: FullApplicationDraft = {
    matterId: context.matter.id,
    title: template.title,
    supportLevel: template.supportLevel,
    supportNotes: template.supportNotes,
    generatedAt: new Date().toISOString(),
    generatedBy: context.agent?.name || "Aria",
    canGenerate,
    notEnoughEvidenceReason: canGenerate ? undefined : "Not enough approved evidence. Review extracted fields or request client confirmation before generating the full draft.",
    disclaimer: FULL_APPLICATION_DRAFT_DISCLAIMER,
    cover,
    actionFlags: [],
    documentMatrix,
    sections,
    safety
  };
  draft.actionFlags = buildActionFlags(draft);
  return draft;
}

export async function buildFullApplicationDraftForMatter(matterId: string, generatedByUser?: { name?: string | null; email?: string | null }) {
  const [reviewData, safety, clientConfirmationItems] = await Promise.all([
    getDraftReviewData(matterId),
    assessMatterCaseSafety(matterId).catch(() => null),
    buildMatterClientConfirmationItems(matterId).catch(() => [])
  ]);

  const workspace = await prisma.workspace.findUnique({
    where: { id: reviewData.matter.workspaceId },
    select: {
      name: true,
      legalName: true,
      contactEmail: true,
      contactPhone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true
    }
  });

  const assignedAgent = await prisma.user.findUnique({
    where: { id: reviewData.matter.assignedToUserId },
    select: { name: true, email: true, jobTitle: true, notes: true }
  });

  const workspaceAddress = [
    workspace?.addressLine1,
    workspace?.addressLine2,
    workspace?.city,
    workspace?.state,
    workspace?.postalCode,
    workspace?.country
  ].filter(Boolean).join(", ");

  const context: FullDraftContext = {
    matter: {
      id: reviewData.matter.id,
      reference: reviewData.matter.matterReference,
      title: reviewData.matter.title,
      visaSubclass: reviewData.matter.visaSubclass,
      visaStream: reviewData.matter.visaStream,
      stage: reviewData.matter.stage,
      status: reviewData.matter.status,
      readinessScore: reviewData.matter.readinessScore,
      currentVisaStatus: reviewData.matter.currentVisaStatus,
      currentVisaExpiry: reviewData.matter.currentVisaExpiry
    },
    client: {
      firstName: reviewData.matter.client.firstName,
      lastName: reviewData.matter.client.lastName,
      dob: reviewData.matter.client.dob,
      nationality: reviewData.matter.client.nationality,
      email: reviewData.matter.client.email,
      phone: reviewData.matter.client.phone,
      currentVisaStatus: reviewData.matter.client.currentVisaStatus,
      currentVisaExpiry: reviewData.matter.client.currentVisaExpiry
    },
    workspace: {
      name: workspace?.name ?? "Workspace",
      legalName: workspace?.legalName,
      contactEmail: workspace?.contactEmail,
      contactPhone: workspace?.contactPhone,
      address: workspaceAddress
    },
    agent: {
      name: assignedAgent?.name ?? generatedByUser?.name,
      email: assignedAgent?.email ?? generatedByUser?.email,
      jobTitle: assignedAgent?.jobTitle,
      notes: assignedAgent?.notes
    },
    documents: reviewData.matter.documents.map((document: any) => ({
      id: document.id,
      fileName: document.fileName,
      category: document.category,
      extractionStatus: document.extractionStatus,
      reviewStatus: document.reviewStatus
    })),
    draftFields: reviewData.draft.fields.map((field: any) => ({
      key: field.templateField.fieldKey,
      label: field.templateField.label,
      value: field.value,
      manualOverride: field.manualOverride,
      status: field.status,
      confidence: field.confidence,
      sourceSnippet: field.sourceSnippet,
      sourcePageRef: field.sourcePageRef,
      sourceDocument: field.evidenceLinks?.[0]?.document?.fileName
    })),
    clientConfirmationItems: clientConfirmationItems.map((item: any) => ({
      category: item.category,
      label: item.label,
      status: item.status
    })),
    safety: safety
      ? {
          readyForAgentFinalReview: safety.readyForAgentFinalReview,
          hardBlockers: safety.hardBlockers,
          softBlockers: safety.softBlockers,
          recommendedActions: safety.recommendedActions
        }
      : undefined
  };

  return buildFullApplicationDraftFromContext(context);
}
