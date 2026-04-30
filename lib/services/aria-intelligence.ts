import {
  DraftFieldStatus,
  ResolutionStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  type Prisma,
  type User
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDraftReviewData } from "@/lib/services/application-draft";
import { isAiConfigured } from "@/lib/services/ai-config";
import { generateAriaAiResponse } from "@/lib/services/ai-provider";
import { runDocumentPipeline } from "@/lib/services/document-pipeline";
import {
  canManageTeam,
  getUserPermissions,
  hasFirmWideAccess,
  hasTeamOversight,
  permissionDefinitions,
  roleLabel,
  scopedMatterWhere
} from "@/lib/services/roles";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

export type IntelligenceItem = {
  title: string;
  detail: string;
  href?: string;
  level?: "critical" | "high" | "medium" | "low";
};

export type OverviewIntelligence = {
  status: "ai" | "derived" | "not_configured";
  summary: string;
  urgentActions: IntelligenceItem[];
  followUps: IntelligenceItem[];
  riskWarnings: IntelligenceItem[];
  recommendedOrder: string[];
  workload: Array<{
    userId: string;
    name: string;
    role: string;
    activeMatters: number;
    openTasks: number;
    pendingReviews: number;
  }>;
  securityWarnings: IntelligenceItem[];
  configMessage?: string;
};

export type MatterIntelligence = {
  status: "ai" | "derived" | "not_configured";
  summary: string;
  matterHealth: string;
  nextBestAction: string;
  clientFollowUpSuggestion: string;
  finalReviewNote: string;
  evidenceGaps: string[];
  draftWeaknesses: string[];
  riskWarnings: string[];
  configMessage?: string;
};

export type DocumentIntelligence = {
  summary: string;
  extractedFieldCount: number;
  weakOcr: boolean;
  weakEvidence: string[];
  categorySuggestion?: string;
  draftLinks: string[];
  checklistLinks: string[];
};

function daysUntil(date: Date | null | undefined) {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function truncate(text: string, max = 180) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function permissionCount(user: Pick<User, "role" | "status" | "permissionsJson">) {
  return permissionDefinitions.filter((permission) => getUserPermissions(user)[permission.key]).length;
}

const BRIEFING_PROMPT = `
You are Aria, an AI migration workbench for registered migration agents.

Create a concise operational daily briefing from the supplied database facts.

Rules:
- Do not fabricate missing data.
- Do not give legal conclusions.
- Focus on practical priorities, follow-ups, risks, and order of work.
- Respect that all outputs are AI-assisted and review required.

Return strict JSON only:
{
  "summary": string,
  "urgentActions": [{"title": string, "detail": string}],
  "followUps": [{"title": string, "detail": string}],
  "riskWarnings": [{"title": string, "detail": string}],
  "recommendedOrder": string[]
}
`;

const MATTER_PROMPT = `
You are Aria, an AI migration workbench for registered migration agents.

Review a single migration matter and return grounded operational guidance.

Rules:
- Do not claim final legal conclusions.
- Keep the answer practical and short.
- Use only supplied matter, draft, document, validation, and update context.
- Review remains required.

Return strict JSON only:
{
  "summary": string,
  "matterHealth": string,
  "nextBestAction": string,
  "clientFollowUpSuggestion": string,
  "finalReviewNote": string,
  "evidenceGaps": string[],
  "draftWeaknesses": string[],
  "riskWarnings": string[]
}
`;

function deriveOverviewSignals(data: {
  matters: Array<any>;
  draftFields: Array<any>;
  upcomingAppointments: Array<any>;
  auditEvents: Array<any>;
  users: Array<any>;
  workload: OverviewIntelligence["workload"];
}) {
  const now = new Date();

  const urgentActions: IntelligenceItem[] = [];
  const followUps: IntelligenceItem[] = [];
  const riskWarnings: IntelligenceItem[] = [];
  const securityWarnings: IntelligenceItem[] = [];

  for (const matter of data.matters) {
    const missingChecklist = matter.checklistItems.filter((item: any) => item.required && !item.documentId);
    const openIssues = matter.validationIssues.length;
    const expiryDays = daysUntil(matter.currentVisaExpiry);
    const deadlineDays = daysUntil(matter.criticalDeadline);
    const overdueRequest = matter.documentRequests.find(
      (request: any) => request.status !== "COMPLETED" && request.dueDate && request.dueDate < now
    );
    const intakePending = matter.intakeRequests.find((request: any) => ["SENT", "VIEWED"].includes(request.status));

    if (openIssues >= 3 || matter.readinessScore < 55) {
      urgentActions.push({
        title: `${matter.client.firstName} ${matter.client.lastName} is blocked`,
        detail: `${openIssues} open validation item(s), readiness ${matter.readinessScore}%, and ${missingChecklist.length} missing required checklist item(s).`,
        href: `/app/matters/${matter.id}/draft`,
        level: "high"
      });
    }

    if (expiryDays !== null && expiryDays <= 30) {
      urgentActions.push({
        title: `${matter.client.firstName} ${matter.client.lastName} visa expiry is approaching`,
        detail: `Current visa expiry is in ${Math.max(expiryDays, 0)} day(s). Confirm next action and client follow-up.`,
        href: `/app/matters/${matter.id}`,
        level: expiryDays <= 7 ? "critical" : "high"
      });
    }

    if (deadlineDays !== null && deadlineDays <= 21) {
      urgentActions.push({
        title: `${matter.client.firstName} ${matter.client.lastName} has a critical deadline`,
        detail: `Critical deadline is in ${Math.max(deadlineDays, 0)} day(s). Check submission readiness and outstanding evidence.`,
        href: `/app/matters/${matter.id}`,
        level: deadlineDays <= 7 ? "critical" : "high"
      });
    }

    if (overdueRequest) {
      followUps.push({
        title: `Follow up overdue document request`,
        detail: `${matter.client.firstName} ${matter.client.lastName} still has outstanding evidence after the due date.`,
        href: `/app/document-requests/${overdueRequest.id}`,
        level: "medium"
      });
    }

    if (intakePending) {
      followUps.push({
        title: `Check incomplete intake`,
        detail: `${matter.client.firstName} ${matter.client.lastName} has opened intake but has not completed submission yet.`,
        href: `/app/intake/${intakePending.id}`,
        level: "medium"
      });
    }

    if (missingChecklist.length) {
      followUps.push({
        title: `Evidence still missing for ${matter.client.firstName} ${matter.client.lastName}`,
        detail: `${missingChecklist.slice(0, 2).map((item: any) => item.label).join(", ")}${missingChecklist.length > 2 ? " and more" : ""}.`,
        href: `/app/matters/${matter.id}/checklist`,
        level: "medium"
      });
    }

    if (matter.impacts.length) {
      riskWarnings.push({
        title: `Official update review still open`,
        detail: `${matter.impacts.length} update impact(s) are still flagged on ${matter.client.firstName} ${matter.client.lastName}.`,
        href: `/app/matters/${matter.id}`,
        level: "medium"
      });
    }
  }

  const pendingDraftFields = data.draftFields.filter((field) =>
    [DraftFieldStatus.NEEDS_REVIEW, DraftFieldStatus.CONFLICTING, DraftFieldStatus.MISSING].includes(field.status)
  );

  if (pendingDraftFields.length) {
    const top = pendingDraftFields[0];
    urgentActions.push({
      title: "Draft field review queue needs attention",
      detail: `${pendingDraftFields.length} draft field(s) remain in review-required states. Next: ${top.templateField.label} for ${top.draft.matter.client.firstName} ${top.draft.matter.client.lastName}.`,
      href: `/app/matters/${top.draft.matterId}/draft`,
      level: "medium"
    });
  }

  if (data.upcomingAppointments.length) {
    const soon = data.upcomingAppointments[0];
    followUps.push({
      title: "Prepare upcoming appointment",
      detail: `${soon.meetingType} is scheduled for ${soon.matter?.client.firstName ?? soon.requestedByName ?? "a client"} at ${soon.startsAt.toLocaleString("en-AU")}.`,
      href: "/app/appointments",
      level: "low"
    });
  }

  const accessDeniedCount = data.auditEvents.filter((event) => event.action === "access.denied").length;
  if (accessDeniedCount) {
    securityWarnings.push({
      title: "Access-denied events recorded",
      detail: `${accessDeniedCount} blocked access attempt(s) were logged recently. Review scope and permission patterns.`,
      href: "/app/team",
      level: "medium"
    });
  }

  const recentExports = data.auditEvents.filter((event) => event.action === "exported").length;
  if (recentExports) {
    securityWarnings.push({
      title: "Recent data exports detected",
      detail: `${recentExports} export action(s) were recorded recently. Confirm the business need and handling of downloaded data.`,
      href: "/app/settings/data",
      level: "medium"
    });
  }

  const inactiveInvites = data.users.filter(
    (member) =>
      member.status === UserStatus.INVITED &&
      member.invitedAt &&
      Date.now() - new Date(member.invitedAt).getTime() > 7 * 24 * 60 * 60 * 1000
  );
  if (inactiveInvites.length) {
    securityWarnings.push({
      title: "Invited staff are still inactive",
      detail: `${inactiveInvites.length} invite(s) are older than 7 days. Resend or deactivate them if they are no longer needed.`,
      href: "/app/team",
      level: "low"
    });
  }

  const riskyVisibilityUsers = data.users.filter((member) => {
    if ([UserRole.COMPANY_OWNER, UserRole.COMPANY_ADMIN, UserRole.PRINCIPAL_REGISTERED_MIGRATION_AGENT].includes(member.role)) return false;
    return member.visibilityScope !== UserVisibilityScope.ASSIGNED_ONLY || permissionCount(member) > 8;
  });
  if (riskyVisibilityUsers.length) {
    securityWarnings.push({
      title: "Review broad staff access",
      detail: `${riskyVisibilityUsers.length} non-admin user(s) have broader visibility or unusually wide feature access. Confirm they still need it.`,
      href: "/app/team",
      level: "medium"
    });
  }

  const activeOwners = data.users.filter((member) => member.role === UserRole.COMPANY_OWNER && member.status === UserStatus.ACTIVE);
  if (activeOwners.length === 0) {
    securityWarnings.push({
      title: "No active company owner found",
      detail: "The workspace should keep at least one active owner account for recovery and governance.",
      href: "/app/team",
      level: "critical"
    });
  }

  const summary = urgentActions.length
    ? `${urgentActions.length} urgent workflow item(s) need attention today, with ${followUps.length} follow-up queue item(s) and ${securityWarnings.length + riskWarnings.length} risk warning(s).`
    : followUps.length
      ? `No critical blockers are visible, but ${followUps.length} follow-up item(s) and ${securityWarnings.length + riskWarnings.length} risk warning(s) still need review.`
      : "No urgent blockers are visible right now. Keep working through assigned matters, evidence review, and scheduled follow-ups.";

  const recommendedOrder = [
    urgentActions[0]?.title ? `Resolve ${urgentActions[0].title.toLowerCase()}.` : "",
    pendingDraftFields.length ? "Clear draft fields that remain missing, conflicting, or review-required." : "",
    followUps[0]?.title ? `Send or review ${followUps[0].title.toLowerCase()}.` : "",
    securityWarnings[0]?.title ? `Check ${securityWarnings[0].title.toLowerCase()} before broadening access or exporting more data.` : ""
  ].filter(Boolean);

  return {
    summary,
    urgentActions: urgentActions.slice(0, 6),
    followUps: followUps.slice(0, 6),
    riskWarnings: [...riskWarnings, ...securityWarnings].slice(0, 6),
    securityWarnings: securityWarnings.slice(0, 6),
    recommendedOrder: recommendedOrder.slice(0, 5)
  };
}

export async function getOverviewIntelligence(workspaceId: string, user: ScopedUser): Promise<OverviewIntelligence> {
  const matterWhere = scopedMatterWhere(user);
  const canSeeTeam = canManageTeam(user) || hasFirmWideAccess(user) || hasTeamOversight(user);

  const [matters, draftFields, upcomingAppointments, auditEvents, users, taskCounts] = await Promise.all([
    prisma.matter.findMany({
      where: matterWhere,
      include: {
        client: true,
        assignedToUser: true,
        validationIssues: {
          where: { resolutionStatus: { in: [ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS] } }
        },
        checklistItems: true,
        documentRequests: true,
        intakeRequests: true,
        impacts: { where: { status: { in: ["NEW", "REVIEWING"] } } }
      },
      orderBy: [{ readinessScore: "asc" }, { updatedAt: "desc" }],
      take: 24
    }),
    prisma.matterDraftField.findMany({
      where: {
        draft: { matter: matterWhere },
        status: { in: [DraftFieldStatus.NEEDS_REVIEW, DraftFieldStatus.CONFLICTING, DraftFieldStatus.MISSING] }
      },
      include: {
        templateField: true,
        draft: {
          include: {
            matter: { include: { client: true } }
          }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 20
    }),
    prisma.appointment.findMany({
      where: {
        workspaceId,
        startsAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        ...(user ? { matter: matterWhere } : {})
      },
      include: { matter: { include: { client: true } } },
      orderBy: { startsAt: "asc" },
      take: 8
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        action: { in: ["access.denied", "exported"] }
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    canSeeTeam
      ? prisma.user.findMany({
          where: { workspaceId },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            role: true,
            status: true,
            invitedAt: true,
            lastActiveAt: true,
            deactivatedAt: true,
            permissionsJson: true,
            visibilityScope: true,
            _count: {
              select: {
                mattersAssigned: true
              }
            }
          }
        })
      : Promise.resolve([]),
    canSeeTeam
      ? prisma.task.groupBy({
          by: ["assignedToUserId"],
          where: { workspaceId, status: { not: "DONE" } },
          _count: { _all: true }
        })
      : Promise.resolve([])
  ]);

  const taskCountMap = new Map(taskCounts.map((row: any) => [row.assignedToUserId, row._count._all]));
  const workload = canSeeTeam
    ? users.map((member: any) => {
        const assignedMatterIds = matters.filter((matter) => matter.assignedToUserId === member.id).map((matter) => matter.id);
        const pendingReviews = draftFields.filter((field) => assignedMatterIds.includes(field.draft.matterId)).length;
        return {
          userId: member.id,
          name: member.name,
          role: roleLabel(member.role),
          activeMatters: member._count.mattersAssigned,
          openTasks: taskCountMap.get(member.id) ?? 0,
          pendingReviews
        };
      })
    : [];

  const derived = deriveOverviewSignals({
    matters,
    draftFields,
    upcomingAppointments,
    auditEvents,
    users,
    workload
  });

  if (!isAiConfigured()) {
    return {
      status: "not_configured",
      ...derived,
      workload,
      securityWarnings: derived.securityWarnings,
      configMessage: "AI is not configured. Add API key in environment variables to enable Aria Daily Briefing."
    };
  }

  try {
    const ai = await generateAriaAiResponse({
      system: BRIEFING_PROMPT,
      user: "Create today's operational briefing for this migration workspace.",
      context: {
        userRole: user.role,
        assignmentScope: hasFirmWideAccess(user) ? "firm-wide" : hasTeamOversight(user) ? "team-overview" : "assigned-only",
        summary: derived.summary,
        urgentActions: derived.urgentActions,
        followUps: derived.followUps,
        riskWarnings: derived.riskWarnings,
        workload: workload.slice(0, 8)
      }
    });

    return {
      status: "ai",
      summary: typeof ai?.summary === "string" ? ai.summary : derived.summary,
      urgentActions: Array.isArray(ai?.urgentActions) && ai.urgentActions.length ? ai.urgentActions.map((item: any, index: number) => ({
        title: String(item.title ?? derived.urgentActions[index]?.title ?? "Urgent review item"),
        detail: String(item.detail ?? derived.urgentActions[index]?.detail ?? "Review required."),
        href: derived.urgentActions[index]?.href,
        level: derived.urgentActions[index]?.level ?? "medium"
      })) : derived.urgentActions,
      followUps: Array.isArray(ai?.followUps) && ai.followUps.length ? ai.followUps.map((item: any, index: number) => ({
        title: String(item.title ?? derived.followUps[index]?.title ?? "Follow-up"),
        detail: String(item.detail ?? derived.followUps[index]?.detail ?? "Follow-up recommended."),
        href: derived.followUps[index]?.href,
        level: derived.followUps[index]?.level ?? "low"
      })) : derived.followUps,
      riskWarnings: Array.isArray(ai?.riskWarnings) && ai.riskWarnings.length ? ai.riskWarnings.map((item: any, index: number) => ({
        title: String(item.title ?? derived.riskWarnings[index]?.title ?? "Risk warning"),
        detail: String(item.detail ?? derived.riskWarnings[index]?.detail ?? "Review required."),
        href: derived.riskWarnings[index]?.href,
        level: derived.riskWarnings[index]?.level ?? "medium"
      })) : derived.riskWarnings,
      recommendedOrder: Array.isArray(ai?.recommendedOrder) && ai.recommendedOrder.length
        ? ai.recommendedOrder.map(String).slice(0, 5)
        : derived.recommendedOrder,
      workload,
      securityWarnings: derived.securityWarnings
    };
  } catch {
    return {
      status: "derived",
      ...derived,
      workload,
      securityWarnings: derived.securityWarnings
    };
  }
}

export async function getMatterIntelligence(input: { matterId: string; user: ScopedUser }): Promise<MatterIntelligence> {
  const matter = await prisma.matter.findFirst({
    where: { id: input.matterId, ...scopedMatterWhere(input.user) },
    include: {
      client: true,
      documents: { orderBy: { createdAt: "desc" } },
      checklistItems: { include: { document: true }, orderBy: { label: "asc" } },
      validationIssues: { orderBy: [{ severity: "desc" }, { createdAt: "desc" }] },
      impacts: { include: { officialUpdate: true }, orderBy: { createdAt: "desc" } },
      intakeRequests: { orderBy: { createdAt: "desc" } },
      documentRequests: { orderBy: { createdAt: "desc" } },
      appointments: { orderBy: { startsAt: "asc" } },
      reviewRequests: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!matter) {
    return {
      status: "derived",
      summary: "Matter intelligence is unavailable because this matter is not accessible in your scope.",
      matterHealth: "Unavailable",
      nextBestAction: "Check matter permissions and assignment scope.",
      clientFollowUpSuggestion: "No client follow-up is available.",
      finalReviewNote: "Review-required status cannot be calculated.",
      evidenceGaps: [],
      draftWeaknesses: [],
      riskWarnings: ["Matter is unavailable in your current assignment scope."]
    };
  }

  const unresolvedIssues = matter.validationIssues.filter(
    (issue) => issue.resolutionStatus !== ResolutionStatus.RESOLVED && issue.resolutionStatus !== ResolutionStatus.DISMISSED
  );
  const missingEvidence = matter.checklistItems.filter((item) => item.required && !item.documentId);
  const latestIntake = matter.intakeRequests[0];
  const latestDocRequest = matter.documentRequests[0];
  const latestReview = matter.reviewRequests[0];
  const expiryDays = daysUntil(matter.currentVisaExpiry);
  const deadlineDays = daysUntil(matter.criticalDeadline);

  let draftWeaknesses: string[] = [];
  let finalReviewNote = "Final migration agent review is still required before client confirmation or submission preparation.";

  if (matter.visaSubclass === "500") {
    const draftReview = await getDraftReviewData(matter.id);
    draftWeaknesses = draftReview.draft.fields
      .filter((field: any) => [DraftFieldStatus.NEEDS_REVIEW, DraftFieldStatus.CONFLICTING, DraftFieldStatus.MISSING].includes(field.status))
      .slice(0, 6)
      .map((field: any) => `${field.templateField.label} is ${field.status.toLowerCase().replaceAll("_", " ")}.`);
    finalReviewNote =
      draftReview.openIssues.length === 0
        ? `Submission-readiness is ${draftReview.draft.readinessScore}%. Source-linked review is still required before moving to client confirmation.`
        : `Submission-readiness is ${draftReview.draft.readinessScore}% with ${draftReview.openIssues.length} open issue(s) still blocking final review.`;
  }

  const evidenceGaps = [
    ...missingEvidence.slice(0, 5).map((item) => `${item.label} still has no linked document.`),
    ...matter.documents.length
      ? []
      : ["No uploaded matter documents are available yet, so source-linked review is still thin."]
  ].slice(0, 6);

  const riskWarnings = [
    ...(expiryDays !== null && expiryDays <= 30 ? [`Current visa expiry is in ${Math.max(expiryDays, 0)} day(s).`] : []),
    ...(deadlineDays !== null && deadlineDays <= 21 ? [`Critical deadline is in ${Math.max(deadlineDays, 0)} day(s).`] : []),
    ...matter.impacts.slice(0, 3).map((impact) => `${impact.officialUpdate.title}: ${impact.reason}`)
  ].slice(0, 6);

  const matterHealth =
    matter.readinessScore >= 85 && unresolvedIssues.length === 0 && missingEvidence.length === 0
      ? "Stable and nearing review"
      : matter.readinessScore >= 65
        ? "Progressing but still review-heavy"
        : "Blocked and needs intervention";

  const nextBestAction =
    unresolvedIssues[0]
      ? `Resolve ${truncate(unresolvedIssues[0].title, 90)}`
      : missingEvidence[0]
        ? `Collect ${missingEvidence[0].label}`
        : latestReview && ["REVIEW_REQUESTED", "SENT_TO_CLIENT", "VIEWED_BY_CLIENT"].includes(latestReview.status)
          ? "Check the current client review request before final cross-check."
          : "Run or re-run final cross-check after confirming linked evidence.";

  const clientFollowUpSuggestion =
    latestDocRequest && latestDocRequest.status !== "COMPLETED"
      ? `Ask ${matter.client.firstName} to upload the remaining requested evidence and confirm any overdue items.`
      : latestIntake && latestIntake.status !== "REVIEWED"
        ? `Follow up with ${matter.client.firstName} to complete or clarify intake answers before relying on the current draft.`
        : missingEvidence.length
          ? `Request the missing evidence from ${matter.client.firstName} before moving deeper into review.`
          : `Confirm that ${matter.client.firstName} is ready for the next review milestone and that no new source documents need to be added.`;

  const derived: MatterIntelligence = {
    status: "derived",
    summary: `${matter.client.firstName} ${matter.client.lastName} is currently ${matterHealth.toLowerCase()}. Readiness is ${matter.readinessScore}% with ${unresolvedIssues.length} unresolved validation item(s) and ${missingEvidence.length} missing required evidence item(s).`,
    matterHealth,
    nextBestAction,
    clientFollowUpSuggestion,
    finalReviewNote,
    evidenceGaps,
    draftWeaknesses,
    riskWarnings
  };

  if (!isAiConfigured()) {
    return {
      ...derived,
      status: "not_configured",
      configMessage: "AI is not configured. Add API key in environment variables to enable Aria matter intelligence."
    };
  }

  try {
    const ai = await generateAriaAiResponse({
      system: MATTER_PROMPT,
      user: `Review this matter and suggest the next operational step.`,
      context: {
        matter: {
          clientName: `${matter.client.firstName} ${matter.client.lastName}`,
          title: matter.title,
          visaSubclass: matter.visaSubclass,
          readinessScore: matter.readinessScore,
          status: matter.status,
          stage: matter.stage
        },
        unresolvedIssues: unresolvedIssues.map((issue) => ({ title: issue.title, severity: issue.severity, description: issue.description })),
        missingEvidence: missingEvidence.map((item) => item.label),
        draftWeaknesses,
        riskWarnings
      }
    });

    return {
      status: "ai",
      summary: typeof ai?.summary === "string" ? ai.summary : derived.summary,
      matterHealth: typeof ai?.matterHealth === "string" ? ai.matterHealth : derived.matterHealth,
      nextBestAction: typeof ai?.nextBestAction === "string" ? ai.nextBestAction : derived.nextBestAction,
      clientFollowUpSuggestion:
        typeof ai?.clientFollowUpSuggestion === "string" ? ai.clientFollowUpSuggestion : derived.clientFollowUpSuggestion,
      finalReviewNote: typeof ai?.finalReviewNote === "string" ? ai.finalReviewNote : derived.finalReviewNote,
      evidenceGaps: Array.isArray(ai?.evidenceGaps) && ai.evidenceGaps.length ? ai.evidenceGaps.map(String).slice(0, 6) : derived.evidenceGaps,
      draftWeaknesses: Array.isArray(ai?.draftWeaknesses) && ai.draftWeaknesses.length ? ai.draftWeaknesses.map(String).slice(0, 6) : derived.draftWeaknesses,
      riskWarnings: Array.isArray(ai?.riskWarnings) && ai.riskWarnings.length ? ai.riskWarnings.map(String).slice(0, 6) : derived.riskWarnings
    };
  } catch {
    return derived;
  }
}

export async function getDocumentIntelligence(document: any): Promise<DocumentIntelligence> {
  const extraction = (document.extractionResults?.[0]?.extractedJson ?? {}) as Record<string, any>;
  const textPreview = typeof extraction.extractedTextPreview === "string" ? extraction.extractedTextPreview.trim() : "";
  const weakOcr = !textPreview || textPreview.length < 80;
  const suggested = await runDocumentPipeline(document.fileName, textPreview);
  const lowConfidenceFields = document.extractedFields.filter((field: any) => field.confidence < 0.75);
  const unsupportedFields = document.extractedFields.filter((field: any) => field.needsReview);
  const draftLinks = (document.draftEvidenceLinks ?? []).map((link: any) => link.draftField.templateField.label);
  const checklistLinks = (document.checklistItems ?? []).map((item: any) => item.label);

  const weakEvidence = [
    ...(weakOcr ? ["OCR/text extraction looks weak or incomplete. Review the original file before relying on extracted content."] : []),
    ...(lowConfidenceFields.length ? [`${lowConfidenceFields.length} extracted field(s) are below strong confidence.`] : []),
    ...(unsupportedFields.length ? [`${unsupportedFields.length} extracted field(s) still require manual review.`] : [])
  ];

  const summaryBits = [
    document.category ? `Stored as ${document.category}.` : "",
    textPreview ? `Preview suggests ${truncate(textPreview, 140)}` : "No reliable text preview is available.",
    draftLinks.length ? `Linked to ${draftLinks.length} draft field(s).` : "No draft field links are stored yet."
  ].filter(Boolean);

  return {
    summary: summaryBits.join(" "),
    extractedFieldCount: document.extractedFields.length,
    weakOcr,
    weakEvidence,
    categorySuggestion: suggested.classification !== document.category ? suggested.classification : undefined,
    draftLinks,
    checklistLinks
  };
}
