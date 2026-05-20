import crypto from "crypto";
import { AppointmentStatus, DocumentRequestItemStatus, DocumentRequestStatus, GeneratedDocumentType, IntakeRequestStatus, MatterStage, MatterStatus, Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAriaAiResponse } from "@/lib/services/ai-provider";
import { isAiConfigured } from "@/lib/services/ai-config";
import { auditEvent, auditMatterAction } from "@/lib/services/audit";
import { createPathwayAnalysis, type PathwayProfileInput } from "@/lib/services/pathway-analysis";
import { resolveBaseUrl } from "@/lib/services/runtime-config";
import { encryptJson, encryptString } from "@/lib/security/encryption";
import { hashPortalToken } from "@/lib/security/hash";
import { getOrCreateWorkspaceOperationalSettings } from "@/lib/services/workspace-operational-settings";
import { buildGeneratedDocumentForMatter } from "@/lib/services/draft-generation";
import { generateVisaDraftPack } from "@/lib/services/visa-draft-pack";

const PORTAL_TOKEN_DAYS = 30;
const REQUEST_TOKEN_DAYS = 14;

const clientPortalSelect = Prisma.validator<Prisma.ClientPortalAccessTokenSelect>()({
  id: true,
  workspaceId: true,
  clientId: true,
  matterId: true,
  createdByUserId: true,
  label: true,
  purpose: true,
  expiresAt: true,
  lastViewedAt: true,
  createdAt: true,
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true
    }
  },
  matter: {
    select: {
      id: true,
      matterReference: true,
      title: true,
      visaSubclass: true,
      visaStream: true,
      status: true,
      stage: true,
      lodgementTargetDate: true,
      assignedToUserId: true,
      readinessScore: true,
      assignedToUser: { select: { id: true, name: true, email: true, jobTitle: true } },
      checklistItems: {
        select: {
          id: true,
          documentId: true,
          itemKey: true,
          category: true,
          label: true,
          description: true,
          status: true,
          required: true,
          dueDate: true,
          requestedAt: true,
          reviewedAt: true,
          document: {
            select: {
              id: true,
              fileName: true,
              category: true,
              mimeType: true,
              fileSize: true,
              extractionStatus: true,
              reviewStatus: true,
              createdAt: true
            }
          }
        },
        orderBy: { label: "asc" }
      },
      documents: {
        select: {
          id: true,
          fileName: true,
          category: true,
          mimeType: true,
          fileSize: true,
          extractionStatus: true,
          reviewStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      },
      documentRequests: {
        select: {
          id: true,
          dueDate: true,
          status: true,
          reminderSentAt: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              checklistItemId: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 5
      },
      appointments: {
        select: {
          id: true,
          status: true,
          meetingType: true,
          startsAt: true,
          createdAt: true
        },
        orderBy: { startsAt: "desc" },
        take: 5
      },
      reviewRequests: {
        select: {
          id: true,
          status: true,
          sentAt: true,
          viewedAt: true,
          confirmedAt: true,
          returnedAt: true,
          expiresAt: true
        },
        orderBy: { createdAt: "desc" }
      },
      officialFormDrafts: {
        where: { status: { in: ["APPROVED", "PUBLISHED"] as any } },
        select: {
          id: true,
          status: true,
          generatedFileName: true,
          approvedAt: true,
          publishedToClientAt: true,
          updatedAt: true
        },
        orderBy: { updatedAt: "desc" }
      },
      timelineEvents: {
        select: {
          id: true,
          eventType: true,
          title: true,
          description: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" },
        take: 30
      }
    }
  }
});

const documentRequestSelect = Prisma.validator<Prisma.DocumentRequestSelect>()({
  id: true,
  workspaceId: true,
  clientId: true,
  matterId: true,
  createdByUserId: true,
  recipientName: true,
  recipientEmail: true,
  message: true,
  dueDate: true,
  status: true,
  expiresAt: true,
  viewedAt: true,
  completedAt: true,
  reminderSentAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, firstName: true, lastName: true, email: true } },
  matter: {
    select: {
      id: true,
      title: true,
      visaSubclass: true,
      visaStream: true,
      assignedToUserId: true,
      checklistItems: {
        select: {
          id: true,
          documentId: true,
          itemKey: true,
          category: true,
          label: true,
          description: true,
          status: true,
          required: true,
          dueDate: true,
          requestedAt: true,
          reviewedAt: true,
          document: {
            select: {
              id: true,
              fileName: true,
              category: true,
              mimeType: true,
              fileSize: true,
              extractionStatus: true,
              reviewStatus: true,
              createdAt: true
            }
          }
        },
        orderBy: { label: "asc" }
      }
    }
  },
  items: {
    include: {
      checklistItem: {
        select: {
          id: true,
          documentId: true,
          itemKey: true,
          category: true,
          label: true,
          description: true,
          status: true,
          required: true,
          dueDate: true,
          requestedAt: true,
          reviewedAt: true,
          document: {
            select: {
              id: true,
              fileName: true,
              category: true,
              mimeType: true,
              fileSize: true,
              extractionStatus: true,
              reviewStatus: true,
              createdAt: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  }
});

export const checklistTemplates: Record<string, Array<{ key: string; category: string; label: string; description: string; required: boolean }>> = {
  "500": [
    { key: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page and any recent passport changes.", required: true },
    { key: "coe", category: "Education", label: "Confirmation of Enrolment", description: "Course enrolment evidence for the intended provider.", required: true },
    { key: "funds", category: "Financial", label: "Financial capacity evidence", description: "Bank statements or other evidence supporting available funds.", required: true },
    { key: "english", category: "Education", label: "English evidence", description: "IELTS/PTE or exemption evidence where relevant.", required: true },
    { key: "oshc", category: "Health / Insurance", label: "OSHC / health insurance", description: "Health insurance evidence for the required study period.", required: true },
    { key: "genuine_student", category: "Statements / Declarations", label: "Genuine student statement", description: "Statement and supporting evidence for genuine student factors.", required: true }
  ],
  "485": [
    { key: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page and any recent passport changes.", required: true },
    { key: "current_visa", category: "Travel", label: "Current visa / VEVO / grant notice", description: "Current visa evidence, grant notice, or VEVO outcome for the applicant.", required: true },
    { key: "completion", category: "Education", label: "Australian study completion evidence", description: "Completion letter, transcript, or provider evidence showing the qualifying study has been completed.", required: true },
    { key: "english", category: "Education", label: "English evidence", description: "English test or exemption evidence where relevant to the selected stream.", required: true },
    { key: "afp", category: "Statements / Declarations", label: "AFP / police clearance", description: "Australian Federal Police check or other police evidence where required.", required: true },
    { key: "insurance", category: "Health / Insurance", label: "Health insurance evidence", description: "OVHC or other relevant health insurance evidence for the intended stay period.", required: true }
  ],
  "482": [
    { key: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page.", required: true },
    { key: "cv", category: "Employment", label: "Resume / CV", description: "Current CV with role chronology.", required: true },
    { key: "employment_refs", category: "Employment", label: "Employment references", description: "Detailed employment references matching the nominated occupation.", required: true },
    { key: "nomination", category: "Employment", label: "Employer nomination pack", description: "Sponsorship and nomination support documents.", required: true },
    { key: "english", category: "Education", label: "English evidence", description: "English test or exemption evidence.", required: true }
  ],
  "186": [
    { key: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page.", required: true },
    { key: "skills", category: "Employment", label: "Skills assessment / occupation evidence", description: "Assessment or equivalent eligibility evidence.", required: true },
    { key: "employment_refs", category: "Employment", label: "Employment references", description: "Detailed employment references and contract history.", required: true },
    { key: "nomination", category: "Employment", label: "Employer nomination documents", description: "Nomination approval and business support evidence.", required: true }
  ],
  "309/100": [
    { key: "applicant_passport", category: "Identity", label: "Applicant passport bio page", description: "Current passport biodata page for the applicant.", required: true },
    { key: "sponsor_identity", category: "Relationship", label: "Sponsor identity and status evidence", description: "Sponsor passport/citizenship/permanent residence identity evidence.", required: true },
    { key: "relationship_evidence", category: "Relationship", label: "Relationship evidence", description: "Joint finances, household, social, commitment, and communication evidence.", required: true },
    { key: "relationship_timeline", category: "Statements / Declarations", label: "Relationship timeline statement", description: "Chronology of the relationship, key milestones, and periods together/apart.", required: true },
    { key: "witness_statements", category: "Relationship", label: "Witness / Form 888 evidence", description: "Form 888 or equivalent supporting witness statements where relevant.", required: true },
    { key: "health_character", category: "Statements / Declarations", label: "Health and character evidence", description: "Police, health, and declaration evidence for both applicant and any relevant family members.", required: true }
  ],
  "189": [
    { key: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page.", required: true },
    { key: "skills", category: "Employment", label: "Skills assessment", description: "Positive skills assessment for the nominated occupation.", required: true },
    { key: "english", category: "Education", label: "English evidence", description: "English test result where required.", required: true },
    { key: "employment_refs", category: "Employment", label: "Employment references", description: "Work references to support points claims.", required: true }
  ],
  "190": [
    { key: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page.", required: true },
    { key: "skills", category: "Employment", label: "Skills assessment", description: "Positive skills assessment for the nominated occupation.", required: true },
    { key: "english", category: "Education", label: "English evidence", description: "English test result where required.", required: true },
    { key: "nomination", category: "Forms", label: "State nomination evidence", description: "State or territory nomination support evidence.", required: true }
  ],
  "491": [
    { key: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page.", required: true },
    { key: "skills", category: "Employment", label: "Skills assessment", description: "Positive skills assessment for the nominated occupation.", required: true },
    { key: "english", category: "Education", label: "English evidence", description: "English test result where required.", required: true },
    { key: "regional", category: "Other Evidence", label: "Regional / sponsor evidence", description: "Regional nomination or eligible family sponsor evidence.", required: true }
  ],
  "600": [
    { key: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page.", required: true },
    { key: "itinerary", category: "Travel", label: "Travel purpose and itinerary", description: "Travel plan, business visitor purpose, or family visit context.", required: true },
    { key: "funds", category: "Financial", label: "Financial capacity evidence", description: "Funds to support the visit.", required: true },
    { key: "ties", category: "Other Evidence", label: "Home-country ties evidence", description: "Employment, family, study, or other ties supporting temporary stay.", required: true }
  ],
  "820/801": [
    { key: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page.", required: true },
    { key: "relationship", category: "Relationship", label: "Relationship evidence", description: "Joint finances, household, social, and commitment evidence.", required: true },
    { key: "sponsor", category: "Relationship", label: "Sponsor evidence", description: "Sponsor identity, status, and declarations.", required: true },
    { key: "history", category: "Statements / Declarations", label: "Relationship history statements", description: "Statements about the relationship timeline and living arrangements.", required: true }
  ]
};

function createToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string) {
  return hashPortalToken(token);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function baseUrl(requestOrigin?: string | null) {
  const resolved = resolveBaseUrl({ requestOrigin });
  if (!resolved) {
    throw new Error("Unable to determine the application base URL for secure portal links. Configure NEXTAUTH_URL or use a request-origin aware route.");
  }
  return resolved;
}

export function buildClientLink(path: string, token: string, requestOrigin?: string | null) {
  return `${baseUrl(requestOrigin)}${path}/${token}`;
}

function redactForTimeline(value: string, maxLength = 1200) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function addMatterTimelineEvent(input: {
  workspaceId: string;
  matterId: string;
  actorUserId?: string | null;
  eventType: string;
  title: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.matterTimelineEvent.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      actorUserId: input.actorUserId ?? undefined,
      eventType: input.eventType,
      title: input.title,
      description: input.description,
      metadataJson: input.metadata
    }
  });
}

async function createWorkflowTask(input: {
  workspaceId: string;
  matterId: string;
  assignedToUserId: string;
  title: string;
  description: string;
  dueDate?: Date;
  priority?: TaskPriority;
}) {
  return prisma.task.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      assignedToUserId: input.assignedToUserId,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate ?? addDays(3),
      priority: input.priority ?? TaskPriority.MEDIUM,
      status: TaskStatus.OPEN
    }
  });
}

export async function ensureClientPortalToken(input: {
  workspaceId: string;
  clientId: string;
  matterId?: string | null;
  label: string;
  createdByUserId?: string | null;
  requestOrigin?: string | null;
}) {
  const settings = await getOrCreateWorkspaceOperationalSettings(input.workspaceId);
  const token = createToken();
  const record = await prisma.clientPortalAccessToken.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      matterId: input.matterId ?? undefined,
      createdByUserId: input.createdByUserId ?? undefined,
      label: input.label,
      purpose: "CLIENT_PORTAL",
      tokenHash: hashToken(token),
      expiresAt: addDays(settings.clientPortalExpiryDays || PORTAL_TOKEN_DAYS)
    }
  });
  return { record, token, url: buildClientLink("/client/portal", token, input.requestOrigin) };
}

export async function getClientPortalByToken(token: string) {
  const record = await prisma.clientPortalAccessToken.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() }, revokedAt: null },
    select: clientPortalSelect
  });
  if (!record) return null;
  await prisma.clientPortalAccessToken.update({ where: { id: record.id }, data: { lastViewedAt: new Date() } }).catch(() => null);
  await auditEvent({
    workspaceId: record.workspaceId,
    userId: record.createdByUserId ?? record.matter?.assignedToUserId ?? undefined,
    entityType: "ClientPortalAccessToken",
    entityId: record.id,
    action: "portal.used",
    metadata: { matterId: record.matterId ?? null, clientId: record.clientId }
  });
  return record;
}

export async function createClientIntakeRequest(input: {
  workspaceId: string;
  createdByUserId: string;
  clientId?: string;
  matterId?: string;
  title: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  workflowType?: "INTAKE" | "CLIENT_CONFIRMATION";
  requestOrigin?: string | null;
}) {
  const token = createToken();
  const request = await prisma.clientIntakeRequest.create({
    data: {
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
      clientId: input.clientId,
      matterId: input.matterId,
      title: input.title,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      message: input.message,
      status: IntakeRequestStatus.SENT,
      tokenHash: hashToken(token),
      expiresAt: addDays(REQUEST_TOKEN_DAYS),
      revokedAt: null
    }
  });

  if (input.matterId) {
    await addMatterTimelineEvent({
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      actorUserId: input.createdByUserId,
      eventType: input.workflowType === "CLIENT_CONFIRMATION" ? "client_confirmation.sent" : "intake.sent",
      title: input.workflowType === "CLIENT_CONFIRMATION" ? "Client confirmation request sent" : "Client intake sent",
      description: input.message
    });
    await auditMatterAction({
      workspaceId: input.workspaceId,
      userId: input.createdByUserId,
      matterId: input.matterId,
      action: input.workflowType === "CLIENT_CONFIRMATION" ? "client_confirmation.sent" : "intake.sent"
    });
    await createWorkflowTask({
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      assignedToUserId: input.createdByUserId,
      title: "Monitor client intake submission",
      description: "Track whether the client has completed the intake questionnaire.",
      dueDate: addDays(7),
      priority: TaskPriority.MEDIUM
    }).catch(() => null);
  }

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.createdByUserId,
    entityType: "ClientIntakeRequest",
    entityId: request.id,
    action: input.workflowType === "CLIENT_CONFIRMATION" ? "client_confirmation.sent" : "intake.sent",
    metadata: { recipientEmail: input.recipientEmail ?? null, workflowType: input.workflowType ?? "INTAKE" }
  });

  return { request, token, url: buildClientLink("/client/intake", token, input.requestOrigin) };
}

export async function getIntakeRequestByToken(token: string) {
  return prisma.clientIntakeRequest.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() }, revokedAt: null },
    include: { client: true, matter: true }
  });
}

export async function markIntakeViewed(token: string) {
  const request = await getIntakeRequestByToken(token);
  if (!request) return null;
  if (!request.viewedAt) {
    await prisma.clientIntakeRequest.update({
      where: { id: request.id },
      data: { viewedAt: new Date(), status: request.status === IntakeRequestStatus.SENT ? IntakeRequestStatus.VIEWED : request.status }
    });
    await auditEvent({
      workspaceId: request.workspaceId,
      userId: request.createdByUserId,
      entityType: "ClientIntakeRequest",
      entityId: request.id,
      action: "intake.viewed",
      metadata: { matterId: request.matterId ?? null, clientId: request.clientId ?? null }
    });
  }
  return request;
}

export async function submitIntake(token: string, questionnaireJson: Prisma.InputJsonValue) {
  const request = await getIntakeRequestByToken(token);
  if (!request) return null;

  const updated = await prisma.clientIntakeRequest.update({
    where: { id: request.id },
    data: {
      questionnaireJson: encryptJson(questionnaireJson),
      submittedAt: new Date(),
      status: IntakeRequestStatus.SUBMITTED
    },
    include: { client: true, matter: true }
  });

  if (updated.clientId) {
    const payload = questionnaireJson as Record<string, unknown>;
    await prisma.client.update({
      where: { id: updated.clientId },
      data: {
        currentVisaStatus: typeof payload.currentVisaStatus === "string" ? payload.currentVisaStatus : undefined,
        currentVisaExpiry: typeof payload.currentVisaExpiry === "string" && payload.currentVisaExpiry ? new Date(payload.currentVisaExpiry) : undefined,
        nationality: typeof payload.nationality === "string" ? payload.nationality : undefined,
        notes: typeof payload.notes === "string" ? encryptString(payload.notes) : undefined
      }
    }).catch(() => null);
  }

  if (updated.matterId) {
    const payload = questionnaireJson as Record<string, unknown>;
    const clientConfirmations = payload.clientConfirmations as Record<string, unknown> | undefined;
    await prisma.matter.update({
      where: { id: updated.matterId },
      data: {
        currentVisaStatus: typeof payload.currentVisaStatus === "string" ? payload.currentVisaStatus : undefined,
        currentVisaExpiry: typeof payload.currentVisaExpiry === "string" && payload.currentVisaExpiry ? new Date(payload.currentVisaExpiry) : undefined,
        stage: MatterStage.EVIDENCE,
        status: MatterStatus.AWAITING_DOCS
      }
    }).catch(() => null);
    await addMatterTimelineEvent({
      workspaceId: updated.workspaceId,
      matterId: updated.matterId,
      eventType: clientConfirmations ? "client_confirmation.submitted" : "intake.submitted",
      title: clientConfirmations ? "Client confirmation submitted" : "Client intake submitted",
      description: clientConfirmations
        ? "Client submitted structured confirmations for migration agent review."
        : "Client submitted questionnaire details for review."
    });
    await auditMatterAction({
      workspaceId: updated.workspaceId,
      userId: updated.createdByUserId,
      matterId: updated.matterId,
      action: clientConfirmations ? "client_confirmation.submitted" : "intake.submitted",
      metadata: clientConfirmations ? { confirmationItemCount: Array.isArray(clientConfirmations.items) ? clientConfirmations.items.length : 0 } : undefined
    });
    const matter = await prisma.matter.findUnique({ where: { id: updated.matterId } });
    if (matter) {
      await createWorkflowTask({
        workspaceId: updated.workspaceId,
        matterId: updated.matterId,
        assignedToUserId: matter.assignedToUserId,
        title: "Review submitted client intake",
        description: "Review the newly submitted intake details and confirm matter next steps.",
        dueDate: addDays(2),
        priority: TaskPriority.HIGH
      }).catch(() => null);
    }
  }

  await auditEvent({
    workspaceId: updated.workspaceId,
    userId: updated.createdByUserId,
    entityType: "ClientIntakeRequest",
    entityId: updated.id,
    action: (() => {
      const payload = questionnaireJson as Record<string, unknown>;
      return payload.clientConfirmations ? "client_confirmation.submitted" : "intake.submitted";
    })(),
    metadata: { matterId: updated.matterId ?? null, clientId: updated.clientId ?? null }
  });

  return updated;
}

export async function createEligibilityScreening(input: PathwayProfileInput & { workspaceId: string; createdByUserId: string; clientId?: string; matterId?: string }) {
  const analysis = await createPathwayAnalysis({
    ...input,
    title: input.title?.trim() || "Eligibility pre-screen",
    workspaceId: input.workspaceId,
    createdByUserId: input.createdByUserId
  });
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.createdByUserId,
    entityType: "EligibilityAnalysis",
    entityId: analysis.id,
    action: "eligibility.created",
    metadata: { matterId: input.matterId ?? null, clientId: input.clientId ?? null }
  });
  if (input.matterId) {
    await addMatterTimelineEvent({
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      actorUserId: input.createdByUserId,
      eventType: "eligibility.created",
      title: "Eligibility pre-screen generated",
      description: analysis.summary
    });
  }
  return analysis;
}

export async function generateChecklistForMatter(matterId: string, userId: string) {
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: matterId } });
  const template = checklistTemplates[matter.visaSubclass] || checklistTemplates[matter.visaSubclass.replace(/\s+/g, "")] || checklistTemplates[`${matter.visaSubclass}/${matter.visaStream}`] || checklistTemplates[`${matter.visaSubclass}/${matter.visaStream}`.replace(/\s+/g, "")];
  const items = template ?? [];

  await prisma.checklistItem.deleteMany({ where: { matterId } });
  await prisma.checklistItem.createMany({
    data: items.map((item) => ({
      matterId,
      itemKey: item.key,
      category: item.category,
      label: item.label,
      description: item.description,
      status: "MISSING",
      required: item.required
    }))
  });

  await addMatterTimelineEvent({
    workspaceId: matter.workspaceId,
    matterId,
    actorUserId: userId,
    eventType: "checklist.generated",
    title: "Visa checklist generated",
    description: `${items.length} checklist items created for Subclass ${matter.visaSubclass}.`
  });
  await auditMatterAction({ workspaceId: matter.workspaceId, userId, matterId, action: "checklist.generated", metadata: { itemCount: items.length } });

  return prisma.checklistItem.findMany({ where: { matterId }, include: { document: true }, orderBy: { label: "asc" } });
}

export async function createDocumentRequest(input: {
  workspaceId: string;
  matterId: string;
  clientId: string;
  createdByUserId: string;
  checklistItemIds: string[];
  dueDate?: Date;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  requestOrigin?: string | null;
}) {
  const token = createToken();
  const request = await prisma.documentRequest.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      clientId: input.clientId,
      createdByUserId: input.createdByUserId,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      message: input.message,
      dueDate: input.dueDate,
      status: DocumentRequestStatus.SENT,
      tokenHash: hashToken(token),
      expiresAt: addDays(REQUEST_TOKEN_DAYS),
      revokedAt: null,
      items: {
        create: input.checklistItemIds.map((id) => ({
          checklistItemId: id,
          status: DocumentRequestItemStatus.REQUESTED
        }))
      }
    },
    include: {
      items: { include: { checklistItem: true } }
    }
  });

  await prisma.checklistItem.updateMany({
    where: { id: { in: input.checklistItemIds } },
    data: {
      status: "REQUESTED",
      requestedAt: new Date(),
      dueDate: input.dueDate
    }
  });

  await addMatterTimelineEvent({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    actorUserId: input.createdByUserId,
    eventType: "documents.requested",
    title: "Document request sent",
    description: input.message ?? "Client document request issued."
  });
  await auditMatterAction({ workspaceId: input.workspaceId, userId: input.createdByUserId, matterId: input.matterId, action: "documents.requested", metadata: { checklistItemIds: input.checklistItemIds } });
  await createWorkflowTask({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    assignedToUserId: input.createdByUserId,
    title: "Follow up on requested documents",
    description: "Check the client portal for uploads and send reminders if evidence remains outstanding.",
    dueDate: input.dueDate ?? addDays(5),
    priority: TaskPriority.HIGH
  }).catch(() => null);

  return { request, token, url: buildClientLink("/client/documents", token, input.requestOrigin) };
}

export async function getDocumentRequestByToken(token: string) {
  return prisma.documentRequest.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() }, revokedAt: null },
    select: documentRequestSelect
  });
}

export async function markDocumentRequestViewed(token: string) {
  const request = await getDocumentRequestByToken(token);
  if (!request) return null;
  if (!request.viewedAt) {
    await prisma.documentRequest.update({
      where: { id: request.id },
      data: { viewedAt: new Date(), status: request.status === DocumentRequestStatus.SENT ? DocumentRequestStatus.VIEWED : request.status }
    });
    await auditEvent({
      workspaceId: request.workspaceId,
      userId: request.createdByUserId,
      entityType: "DocumentRequest",
      entityId: request.id,
      action: "documents.viewed",
      metadata: { matterId: request.matterId, clientId: request.clientId }
    });
  }
  return request;
}

export async function attachDocumentToChecklistItem(checklistItemId: string, documentId: string) {
  const checklistItem = await prisma.checklistItem.update({
    where: { id: checklistItemId },
    data: { documentId, status: "RECEIVED" },
    include: { matter: true }
  });
  await prisma.documentRequestItem.updateMany({
    where: { checklistItemId },
    data: { status: DocumentRequestItemStatus.RECEIVED }
  });
  await addMatterTimelineEvent({
    workspaceId: checklistItem.matter.workspaceId,
    matterId: checklistItem.matterId,
    eventType: "document.uploaded",
    title: "Requested document uploaded",
    description: checklistItem.label
  });
  await prisma.checklistItem.update({
    where: { id: checklistItemId },
    data: { reviewedAt: null }
  }).catch(() => null);
  const actorUserId = checklistItem.matter.assignedToUserId;
  if (actorUserId) {
    await auditMatterAction({
      workspaceId: checklistItem.matter.workspaceId,
      userId: actorUserId,
      matterId: checklistItem.matterId,
      action: "portal.document_uploaded",
      metadata: { checklistItemId, documentId }
    }).catch(() => null);
  }
}

export async function createPortalMessage(input: {
  token: string;
  message: string;
}) {
  const portal = await getClientPortalByToken(input.token);
  if (!portal?.matterId || !portal.matter) return null;
  const message = redactForTimeline(input.message);
  if (!message) return null;

  await addMatterTimelineEvent({
    workspaceId: portal.workspaceId,
    matterId: portal.matterId,
    actorUserId: portal.matter.assignedToUserId,
    eventType: "portal.client_message",
    title: "Client message received",
    description: message
  });

  await auditMatterAction({
    workspaceId: portal.workspaceId,
    userId: portal.matter.assignedToUserId,
    matterId: portal.matterId,
    action: "portal.message.created",
    metadata: { messageLength: message.length, source: "client_portal" }
  }).catch(() => null);

  return { ok: true };
}

export async function createPortalAcknowledgement(input: {
  token: string;
  acknowledgementType: string;
}) {
  const portal = await getClientPortalByToken(input.token);
  if (!portal?.matterId || !portal.matter) return null;
  const acknowledgementType = redactForTimeline(input.acknowledgementType || "Client acknowledgement / confirmation", 120);

  await addMatterTimelineEvent({
    workspaceId: portal.workspaceId,
    matterId: portal.matterId,
    actorUserId: portal.matter.assignedToUserId,
    eventType: "portal.client_acknowledgement",
    title: "Client acknowledgement / confirmation recorded",
    description: `${acknowledgementType}. Registered migration agent review required before use.`
  });

  await auditMatterAction({
    workspaceId: portal.workspaceId,
    userId: portal.matter.assignedToUserId,
    matterId: portal.matterId,
    action: "portal.acknowledgement.created",
    metadata: { acknowledgementType, source: "client_portal" }
  }).catch(() => null);

  return { ok: true };
}

export async function sendDocumentRequestReminder(requestId: string, actorUserId: string) {
  const request = await prisma.documentRequest.update({
    where: { id: requestId },
    data: { reminderSentAt: new Date(), status: DocumentRequestStatus.SENT },
    include: { matter: true, client: true }
  });

  await addMatterTimelineEvent({
    workspaceId: request.workspaceId,
    matterId: request.matterId,
    actorUserId,
    eventType: "documents.reminder_sent",
    title: "Document reminder sent",
    description: request.message ?? "Reminder sent for outstanding requested documents."
  });

  await auditMatterAction({
    workspaceId: request.workspaceId,
    userId: actorUserId,
    matterId: request.matterId,
    action: "documents.reminder_sent",
    metadata: { requestId }
  });

  return request;
}

export async function refreshDocumentRequestAccess(requestId: string, requestOrigin?: string | null) {
  const token = createToken();
  const request = await prisma.documentRequest.update({
    where: { id: requestId },
    data: {
      tokenHash: hashToken(token),
      expiresAt: addDays(REQUEST_TOKEN_DAYS),
      revokedAt: null
    }
  });
  return { request, token, url: buildClientLink("/client/documents", token, requestOrigin) };
}

export async function createAppointment(input: {
  workspaceId: string;
  clientId?: string;
  matterId?: string;
  assignedToUserId?: string;
  requestedByName?: string;
  requestedByEmail?: string;
  status?: AppointmentStatus;
  meetingType: string;
  startsAt: Date;
  notes?: string;
}) {
  const appointment = await prisma.appointment.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      matterId: input.matterId,
      assignedToUserId: input.assignedToUserId,
      requestedByName: input.requestedByName,
      requestedByEmail: input.requestedByEmail,
      status: input.status ?? AppointmentStatus.REQUESTED,
      meetingType: input.meetingType,
      startsAt: input.startsAt,
      notes: input.notes
    }
  });

  if (input.matterId) {
    const eventType = appointment.status === AppointmentStatus.CONFIRMED ? "appointment.booked" : "appointment.requested";
    await addMatterTimelineEvent({
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      actorUserId: input.assignedToUserId,
      eventType,
      title: appointment.status === AppointmentStatus.CONFIRMED ? "Appointment booked" : "Appointment requested",
      description: `${input.meetingType} requested for ${input.startsAt.toLocaleString("en-AU")}.`
    });
    if (input.assignedToUserId) {
      await auditMatterAction({
        workspaceId: input.workspaceId,
        userId: input.assignedToUserId,
        matterId: input.matterId,
        action: eventType,
        metadata: { appointmentId: appointment.id, status: appointment.status }
      }).catch(() => null);
    }
    if (input.assignedToUserId) {
      await createWorkflowTask({
        workspaceId: input.workspaceId,
        matterId: input.matterId,
        assignedToUserId: input.assignedToUserId,
        title: `Prepare for ${input.meetingType.toLowerCase()} appointment`,
        description: "Review matter status, outstanding documents, and key questions before the consultation.",
        dueDate: input.startsAt,
        priority: TaskPriority.MEDIUM
      }).catch(() => null);
    }
  }

  return appointment;
}

export async function generateMatterDocument(input: {
  workspaceId: string;
  matterId: string;
  createdByUserId: string;
  type: GeneratedDocumentType;
}) {
  const deterministic = await buildGeneratedDocumentForMatter(input.matterId, input.type);
  if (deterministic.supported) {
    const draftPack = await generateVisaDraftPack(input.matterId).catch(() => null);
    const combinedContent = draftPack
      ? `${deterministic.content}\n\n---\n\n${draftPack.content}`
      : deterministic.content;
    const generated = await prisma.generatedDocument.create({
      data: {
        workspaceId: input.workspaceId,
        matterId: input.matterId,
        createdByUserId: input.createdByUserId,
        type: input.type,
        title: deterministic.title,
        content: combinedContent
      }
    });

    await addMatterTimelineEvent({
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      actorUserId: input.createdByUserId,
      eventType: "generated_document.created",
      title: "Generated document created",
      description: deterministic.title
    });
    await auditMatterAction({
      workspaceId: input.workspaceId,
      userId: input.createdByUserId,
      matterId: input.matterId,
      action: "draft_pack.generated",
      metadata: {
        type: input.type,
        mode: "deterministic_draft_engine",
        supportedPack: draftPack?.supportedPack ?? null,
        draftPackWarnings: draftPack?.grounded.warnings.slice(0, 6) ?? [],
        ...deterministic.metadata
      }
    });

    return generated;
  }

  if (!isAiConfigured()) {
    throw new Error("AI is not configured. Add OPENAI_API_KEY.");
  }

  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: input.matterId },
    include: { client: true, documents: true, validationIssues: true }
  });

  const draft = await prisma.matterApplicationDraft.findFirst({
    where: { matterId: input.matterId },
    include: {
      fields: { include: { templateField: true, evidenceLinks: { include: { document: true } } } }
    }
  });

  const promptTypeTitles: Record<GeneratedDocumentType, string> = {
    COVER_LETTER: "Cover letter",
    STATUTORY_DECLARATION_TEMPLATE: "Statutory declaration template",
    DOCUMENT_REQUEST_CHECKLIST: "Document request checklist",
    SKILLS_ASSESSMENT_CHECKLIST: "Skills assessment checklist",
    SPONSORSHIP_CHECKLIST: "Sponsorship checklist",
    CHARACTER_REFERENCE_TEMPLATE: "Character reference template",
    GENUINE_STUDENT_STATEMENT_OUTLINE: "Genuine student statement outline"
  };

  const ai = await generateAriaAiResponse({
    system: `You are Aria, assisting a registered migration agent. Draft a ${promptTypeTitles[input.type]} using only the supplied matter context. Use review-required wording and do not claim final legal approval. Return JSON: {"title": string, "content": string}.`,
    user: `Generate a ${promptTypeTitles[input.type]} for this migration matter.`,
    context: {
      matter: {
        title: matter.title,
        visaSubclass: matter.visaSubclass,
        visaStream: matter.visaStream,
        client: `${matter.client.firstName} ${matter.client.lastName}`
      },
      draftFields: draft?.fields.map((field) => ({
        label: field.templateField.label,
        value: field.manualOverride || field.value,
        status: field.status
      })),
      validationIssues: matter.validationIssues.map((issue) => ({ title: issue.title, description: issue.description }))
    }
  }).catch(() => null);

  const title = String(ai?.title || `${promptTypeTitles[input.type]} - ${matter.client.firstName} ${matter.client.lastName}`);
  const content = String(ai?.content || `${promptTypeTitles[input.type]}\n\nReview required.\n\nMatter: ${matter.title}\nClient: ${matter.client.firstName} ${matter.client.lastName}\nVisa subclass: ${matter.visaSubclass}\n\nNo generated AI content was available at this time.`);

  const generated = await prisma.generatedDocument.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      createdByUserId: input.createdByUserId,
      type: input.type,
      title,
      content
    }
  });

  await addMatterTimelineEvent({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    actorUserId: input.createdByUserId,
    eventType: "generated_document.created",
    title: "Generated document created",
    description: title
  });
  await auditMatterAction({ workspaceId: input.workspaceId, userId: input.createdByUserId, matterId: input.matterId, action: "generated_document.created", metadata: { type: input.type } });

  return generated;
}

export async function exportMatterPackage(matterId: string) {
  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: {
      client: true,
      documents: true,
      checklistItems: true,
      validationIssues: true,
      tasks: true,
      reviewRequests: true,
      timelineEvents: { orderBy: { createdAt: "asc" } }
    }
  });
  return matter;
}

export async function archiveMatter(input: { matterId: string; workspaceId: string; userId: string }) {
  const matter = await prisma.matter.update({
    where: { id: input.matterId },
    data: { archivedAt: new Date() }
  });
  await addMatterTimelineEvent({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    actorUserId: input.userId,
    eventType: "matter.archived",
    title: "Matter archived",
    description: "Matter archived from the active workload."
  });
  await auditMatterAction({ workspaceId: input.workspaceId, userId: input.userId, matterId: input.matterId, action: "matter.archived" });
  return matter;
}
