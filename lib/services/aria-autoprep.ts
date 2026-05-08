import { GeneratedDocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createOrGetSubclass500Draft, mapDocumentsToDraft } from "@/lib/services/application-draft";
import { assessMatterCaseSafety } from "@/lib/services/case-safety";
import {
  createClientIntakeRequest,
  createDocumentRequest,
  ensureClientPortalToken,
  generateChecklistForMatter,
  generateMatterDocument
} from "@/lib/services/client-workflows";
import { buildMatterDraftBriefing } from "@/lib/services/draft-generation";
import { generateMatterFormDraft } from "@/lib/services/pdf-form-engine";
import { auditMatterAction } from "@/lib/services/audit";

export type AriaApprovalActionKey =
  | "generate_form_drafts"
  | "generate_internal_drafts"
  | "create_portal_link"
  | "send_intake_request"
  | "send_document_request";

type AutoprepActionResult = {
  key: string;
  label: string;
  status: "completed" | "skipped" | "blocked" | "approved";
  detail: string;
};

type ApprovalCandidate = {
  key: AriaApprovalActionKey;
  label: string;
  description: string;
  enabled: boolean;
  reason: string;
};

type ClientConfirmationItem = {
  key: string;
  title: string;
  detail: string;
  status: "required" | "recommended";
};

function buildClientConfirmationItems(input: {
  visaSubclass: string;
  safety: Awaited<ReturnType<typeof assessMatterCaseSafety>>;
  draftBriefing: Awaited<ReturnType<typeof buildMatterDraftBriefing>> | null;
}) {
  const items: ClientConfirmationItem[] = [];
  const seen = new Set<string>();

  function push(item: ClientConfirmationItem) {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    items.push(item);
  }

  for (const blocker of input.safety.hardBlockers) {
    if (blocker.relatedFieldKey === "statement.genuine_student" || /genuine student/i.test(blocker.title)) {
      push({
        key: "statement.genuine_student",
        title: "Confirm genuine student statement details",
        detail: "Ask the client to confirm their study rationale, why this course/provider was chosen, relevant home-country ties, and future plans after study.",
        status: "required"
      });
    }
    if (/health/i.test(blocker.title) || blocker.relatedFieldKey === "health.declarations") {
      push({
        key: "declarations.health",
        title: "Confirm health declarations",
        detail: "Ask the client to confirm any current health issues, examinations, treatment history, or health-related disclosures that must be reviewed by the agent.",
        status: "required"
      });
    }
    if (/character|criminal/i.test(blocker.title) || blocker.relatedFieldKey === "character.declarations") {
      push({
        key: "declarations.character",
        title: "Confirm character declarations",
        detail: "Ask the client to confirm any refusals, charges, convictions, police matters, or character issues that require explicit disclosure and agent review.",
        status: "required"
      });
    }
    if (/relationship/i.test(blocker.title) || blocker.relatedFieldKey === "declarations.relationship") {
      push({
        key: "declarations.relationship",
        title: "Confirm relationship history",
        detail: "Ask the client to confirm the relationship timeline, living arrangements, and any sponsor or partner declarations before any form is treated as complete.",
        status: "required"
      });
    }
  }

  if (input.visaSubclass === "500") {
    push({
      key: "declarations.health",
      title: "Confirm health / insurance answers",
      detail: "Confirm the client's health history, any required exams, and whether OSHC coverage details match the intended study period.",
      status: "recommended"
    });
    push({
      key: "declarations.character",
      title: "Confirm character / compliance history",
      detail: "Confirm any visa refusals, cancellations, overstays, police clearances, or criminal history before the matter moves toward agent final review.",
      status: "recommended"
    });
  }

  for (const field of input.draftBriefing?.missingFields ?? []) {
    if (/passport|date of birth|nationality/i.test(field.label)) {
      push({
        key: `confirm.${field.label.toLowerCase().replace(/\s+/g, "_")}`,
        title: `Confirm ${field.label.toLowerCase()}`,
        detail: `${field.label} is still unresolved or still needs review. Ask the client to confirm the exact value directly against their source documents.`,
        status: "recommended"
      });
    }
  }

  return items;
}

function buildClientConfirmationMessage(items: ClientConfirmationItem[]) {
  if (!items.length) {
    return "Please review and confirm any outstanding declarations or client-provided details that your migration agent may still need before final review.";
  }

  return [
    "Your migration team needs you to confirm the following items before the matter can move to final review:",
    "",
    ...items.map((item, index) => `${index + 1}. ${item.title} - ${item.detail}`),
    "",
    "Please answer carefully and provide only accurate information. Your registered migration agent will review everything before it is used."
  ].join("\n");
}

export async function runMatterAutoprep(input: {
  matterId: string;
  workspaceId: string;
  userId: string;
  approvedActions?: AriaApprovalActionKey[];
  requestOrigin?: string | null;
}) {
  const approved = new Set(input.approvedActions ?? []);
  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: input.matterId },
    include: {
      client: true,
      checklistItems: { orderBy: { label: "asc" } },
      documents: true,
      intakeRequests: { orderBy: { createdAt: "desc" } },
      documentRequests: { include: { items: true }, orderBy: { createdAt: "desc" } },
      portalAccessTokens: { orderBy: { createdAt: "desc" } }
    }
  });

  const executedActions: AutoprepActionResult[] = [];

  if (matter.visaSubclass === "500") {
    await createOrGetSubclass500Draft(matter.id);
    executedActions.push({
      key: "ensure_draft_workspace",
      label: "Ensure draft workspace",
      status: "completed",
      detail: "Subclass 500 draft workspace is available."
    });
  } else {
    executedActions.push({
      key: "ensure_draft_workspace",
      label: "Ensure draft workspace",
      status: "skipped",
      detail: "Field-level draft workspace is currently strongest for Subclass 500."
    });
  }

  if (!matter.checklistItems.length) {
    await generateChecklistForMatter(matter.id, input.userId);
    executedActions.push({
      key: "generate_checklist",
      label: "Generate checklist",
      status: "completed",
      detail: `Checklist generated for Subclass ${matter.visaSubclass}.`
    });
  } else {
    executedActions.push({
      key: "generate_checklist",
      label: "Generate checklist",
      status: "skipped",
      detail: `${matter.checklistItems.length} checklist item(s) already exist.`
    });
  }

  if (matter.documents.length) {
    await mapDocumentsToDraft(matter.id);
    executedActions.push({
      key: "map_documents_to_draft",
      label: "Map documents to draft",
      status: "completed",
      detail: `${matter.documents.length} document(s) were re-evaluated for source-backed draft mapping.`
    });
  } else {
    executedActions.push({
      key: "map_documents_to_draft",
      label: "Map documents to draft",
      status: "blocked",
      detail: "No uploaded documents are linked to this matter yet."
    });
  }

  const [safety, draftBriefing, templates, refreshedMatter] = await Promise.all([
    assessMatterCaseSafety(matter.id),
    buildMatterDraftBriefing(matter.id).catch(() => null),
    prisma.officialFormTemplate.findMany({
      where: {
        OR: [{ workspaceId: input.workspaceId }, { workspaceId: null }],
        subclassCodes: { has: matter.visaSubclass }
      },
      orderBy: { formNumber: "asc" }
    }),
    prisma.matter.findUniqueOrThrow({
      where: { id: matter.id },
      include: {
        client: true,
        checklistItems: { orderBy: { label: "asc" } },
        intakeRequests: { orderBy: { createdAt: "desc" } },
        documentRequests: { include: { items: true }, orderBy: { createdAt: "desc" } },
        portalAccessTokens: { orderBy: { createdAt: "desc" } }
      }
    })
  ]);

  const mappedTemplates = templates.filter((template) => {
    const mappings = template.fieldMappingsJson && typeof template.fieldMappingsJson === "object"
      ? template.fieldMappingsJson as Record<string, string>
      : {};
    return template.supportStatus === "FILLABLE_PDF" && Object.values(mappings).filter(Boolean).length > 0;
  });

  const latestIntake = refreshedMatter.intakeRequests[0];
  const latestDocumentRequest = refreshedMatter.documentRequests[0];
  const missingChecklistItems = refreshedMatter.checklistItems.filter((item) => !item.documentId && item.required);
  const clientConfirmations = buildClientConfirmationItems({
    visaSubclass: refreshedMatter.visaSubclass,
    safety,
    draftBriefing
  });

  const approvalCandidates: ApprovalCandidate[] = [
    {
      key: "generate_form_drafts",
      label: "Generate mapped form drafts",
      description: "Create or refresh firm or official PDF drafts from stored matter evidence.",
      enabled: mappedTemplates.length > 0,
      reason: mappedTemplates.length
        ? `${mappedTemplates.length} mapped fillable template(s) are available.`
        : "No mapped fillable form template is currently available for this matter."
    },
    {
      key: "generate_internal_drafts",
      label: "Generate internal draft pack",
      description: "Create internal working draft documents such as cover letters and statement outlines.",
      enabled: true,
      reason: "Internal working drafts can be generated without exposing them to the client."
    },
    {
      key: "create_portal_link",
      label: "Create secure client portal link",
      description: "Issue a new scoped portal link for this matter.",
      enabled: refreshedMatter.portalAccessTokens.length === 0,
      reason: refreshedMatter.portalAccessTokens.length
        ? "A portal link already exists for this matter."
        : "No portal link has been issued yet."
    },
    {
      key: "send_intake_request",
      label: "Send client confirmation request",
      description: "Prepare a secure client-facing request for declarations, confirmations, and answers Aria cannot safely infer.",
      enabled: Boolean(refreshedMatter.client.email) && clientConfirmations.length > 0 && latestIntake?.status !== "REVIEWED",
      reason: !refreshedMatter.client.email
        ? "No client email is stored for this matter."
        : !clientConfirmations.length
          ? "No client confirmation items are currently visible from the matter blockers and missing draft fields."
        : latestIntake
          ? `Latest intake request status: ${latestIntake.status.toLowerCase()}.`
          : `${clientConfirmations.length} client confirmation item(s) are ready to send.`
    },
    {
      key: "send_document_request",
      label: "Send document request",
      description: "Issue a secure request for required checklist evidence that is still missing.",
      enabled: Boolean(refreshedMatter.client.email) && missingChecklistItems.length > 0,
      reason: !refreshedMatter.client.email
        ? "No client email is stored for this matter."
        : missingChecklistItems.length
          ? `${missingChecklistItems.length} required checklist item(s) are still missing evidence.`
          : latestDocumentRequest
            ? `Latest document request status: ${latestDocumentRequest.status.toLowerCase()}.`
            : "No required missing checklist evidence is currently visible."
    }
  ];

  const approvedResults: AutoprepActionResult[] = [];

  if (approved.has("generate_form_drafts") && mappedTemplates.length) {
    for (const template of mappedTemplates) {
      const result = await generateMatterFormDraft({ matterId: matter.id, templateId: template.id });
      approvedResults.push({
        key: "generate_form_drafts",
        label: `Generate form draft: ${template.formNumber}`,
        status: result.supported ? "approved" : "blocked",
        detail: result.supported ? "Mapped form draft generated." : result.reason ?? "Form draft generation was blocked."
      });
    }
  }

  if (approved.has("generate_internal_drafts")) {
    const internalTypes: GeneratedDocumentType[] = [
      GeneratedDocumentType.COVER_LETTER,
      GeneratedDocumentType.DOCUMENT_REQUEST_CHECKLIST,
      GeneratedDocumentType.GENUINE_STUDENT_STATEMENT_OUTLINE
    ];
    for (const type of internalTypes) {
      await generateMatterDocument({
        workspaceId: input.workspaceId,
        matterId: matter.id,
        createdByUserId: input.userId,
        type
      });
    }
    approvedResults.push({
      key: "generate_internal_drafts",
      label: "Generate internal draft pack",
      status: "approved",
      detail: "Internal working draft documents were generated for this matter."
    });
  }

  if (approved.has("create_portal_link") && refreshedMatter.portalAccessTokens.length === 0) {
    await ensureClientPortalToken({
      workspaceId: input.workspaceId,
      clientId: refreshedMatter.clientId,
      matterId: refreshedMatter.id,
      label: "Client portal access",
      createdByUserId: input.userId,
      requestOrigin: input.requestOrigin
    });
    approvedResults.push({
      key: "create_portal_link",
      label: "Create secure client portal link",
      status: "approved",
      detail: "A new scoped client portal link was created."
    });
  }

  if (approved.has("send_intake_request") && refreshedMatter.client.email) {
    const intakeTitle = clientConfirmations.length
      ? `Client confirmation tasks - Subclass ${refreshedMatter.visaSubclass}`
      : "Confirm declarations and intake details";
    await createClientIntakeRequest({
      workspaceId: input.workspaceId,
      createdByUserId: input.userId,
      clientId: refreshedMatter.clientId,
      matterId: refreshedMatter.id,
      title: intakeTitle,
      recipientName: `${refreshedMatter.client.firstName} ${refreshedMatter.client.lastName}`.trim(),
      recipientEmail: refreshedMatter.client.email,
      message: buildClientConfirmationMessage(clientConfirmations),
      requestOrigin: input.requestOrigin
    });
    approvedResults.push({
      key: "send_intake_request",
      label: "Send client confirmation request",
      status: "approved",
      detail: clientConfirmations.length
        ? `A secure confirmation request was prepared for ${clientConfirmations.length} client-confirmed item(s).`
        : "A secure intake request was prepared for the client."
    });
  }

  if (approved.has("send_document_request") && refreshedMatter.client.email && missingChecklistItems.length) {
    await createDocumentRequest({
      workspaceId: input.workspaceId,
      matterId: refreshedMatter.id,
      clientId: refreshedMatter.clientId,
      createdByUserId: input.userId,
      checklistItemIds: missingChecklistItems.map((item) => item.id),
      recipientName: `${refreshedMatter.client.firstName} ${refreshedMatter.client.lastName}`.trim(),
      recipientEmail: refreshedMatter.client.email,
      requestOrigin: input.requestOrigin
    });
    approvedResults.push({
      key: "send_document_request",
      label: "Send document request",
      status: "approved",
      detail: `A secure document request was sent for ${missingChecklistItems.length} missing required item(s).`
    });
  }

  await auditMatterAction({
    workspaceId: input.workspaceId,
    userId: input.userId,
    matterId: input.matterId,
    action: "aria.autoprep.run",
    metadata: {
      approvedActions: [...approved],
      executedActions: executedActions.map((item) => ({ key: item.key, status: item.status })),
      approvedResults: approvedResults.map((item) => ({ key: item.key, status: item.status }))
    } as Prisma.InputJsonObject
  });

  return {
    summary: safety.readyForAgentFinalReview
      ? "Aria completed the current prep pass and the matter is now ready for agent final review."
      : `Aria completed the current prep pass. ${safety.hardBlockers.length} hard blocker(s) and ${safety.softBlockers.length} softer review item(s) still remain.`,
    executedActions,
    approvalCandidates,
    approvedResults,
    safety,
    draftBriefing,
    clientConfirmations,
    mappedTemplateCount: mappedTemplates.length,
    missingChecklistCount: missingChecklistItems.length
  };
}
