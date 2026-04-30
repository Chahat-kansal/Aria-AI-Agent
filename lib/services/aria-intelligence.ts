import {
  DraftFieldStatus,
  ResolutionStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  type User
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDraftReviewData } from "@/lib/services/application-draft";
import { aiNotConfiguredResponse, isAiConfigured } from "@/lib/services/ai-config";
import { generateAriaAiResponse } from "@/lib/services/ai-provider";
import { auditAiUsed, auditEvent } from "@/lib/services/audit";
import { runDocumentPipeline } from "@/lib/services/document-pipeline";
import { retrieveRelevantContext } from "@/lib/services/retrieval";
import {
  canAccessMatter,
  canManageTeam,
  getUserPermissions,
  hasFirmWideAccess,
  hasPermission,
  hasTeamOversight,
  permissionDefinitions,
  roleLabel,
  scopedClientWhere,
  scopedMatterWhere
} from "@/lib/services/roles";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;
type Priority = "low" | "medium" | "high" | "critical";

export type AriaIntelligenceAction = {
  title: string;
  reason: string;
  priority: Priority;
  entityType: string;
  entityId: string;
  href: string;
};

export type AriaIntelligenceResult = {
  summary: string;
  urgency: Priority;
  riskScore: number;
  confidence: number;
  groundedFacts: string[];
  reasoning: string[];
  recommendedActions: AriaIntelligenceAction[];
  securityWarnings: string[];
  missingEvidence: string[];
  clientFollowUps: string[];
  citations: { label: string; href: string }[];
  reviewRequired: true;
  status: "ai" | "derived" | "not_configured";
  configMessage?: string;
};

export type OverviewIntelligence = AriaIntelligenceResult & {
  urgentActions: AriaIntelligenceAction[];
  followUps: AriaIntelligenceAction[];
  riskWarningsDetailed: AriaIntelligenceAction[];
  recommendedOrder: string[];
  workload: Array<{
    userId: string;
    name: string;
    role: string;
    activeMatters: number;
    openTasks: number;
    pendingReviews: number;
    stalledMatters: number;
  }>;
  topUrgentActions: AriaIntelligenceAction[];
};

export type MatterIntelligence = AriaIntelligenceResult & {
  matterHealth: string;
  nextBestAction: string;
  clientFollowUpSuggestion: string;
  finalReviewNote: string;
  draftWeaknesses: string[];
  evidenceGaps: string[];
  riskWarnings: string[];
};

export type DocumentIntelligence = AriaIntelligenceResult & {
  extractedFieldCount: number;
  weakOcr: boolean;
  weakEvidence: string[];
  categorySuggestion?: string;
  draftLinks: string[];
  checklistLinks: string[];
};

function clamp(num: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, num));
}

function daysUntil(date: Date | null | undefined) {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function toPriority(value: number): Priority {
  if (value >= 85) return "critical";
  if (value >= 65) return "high";
  if (value >= 35) return "medium";
  return "low";
}

function permissionCount(user: Pick<User, "role" | "status" | "permissionsJson">) {
  return permissionDefinitions.filter((permission) => getUserPermissions(user)[permission.key]).length;
}

function normalizeLines(items: Array<string | null | undefined>, limit = 8) {
  return items.filter(Boolean).map(String).slice(0, limit);
}

function fallbackResult(input: Partial<AriaIntelligenceResult> & Pick<AriaIntelligenceResult, "summary">): AriaIntelligenceResult {
  return {
    summary: input.summary,
    urgency: input.urgency ?? "medium",
    riskScore: input.riskScore ?? 0,
    confidence: input.confidence ?? 0.72,
    groundedFacts: input.groundedFacts ?? [],
    reasoning: input.reasoning ?? [],
    recommendedActions: input.recommendedActions ?? [],
    securityWarnings: input.securityWarnings ?? [],
    missingEvidence: input.missingEvidence ?? [],
    clientFollowUps: input.clientFollowUps ?? [],
    citations: input.citations ?? [],
    reviewRequired: true,
    status: input.status ?? "derived",
    configMessage: input.configMessage
  };
}

async function maybeAiRefine(
  system: string,
  userPrompt: string,
  context: unknown,
  fallback: AriaIntelligenceResult,
  audit?: { workspaceId: string; userId?: string; feature: string; entityId?: string }
) {
  if (!isAiConfigured()) {
    return {
      ...fallback,
      status: "not_configured" as const,
      configMessage: aiNotConfiguredResponse().setup
    };
  }

  try {
    const ai = await generateAriaAiResponse({
      system,
      user: userPrompt,
      context
    });

    if (audit) {
      await auditAiUsed({
        workspaceId: audit.workspaceId,
        userId: audit.userId,
        feature: audit.feature,
        matterId: audit.entityId,
        metadata: { source: "aria-intelligence" }
      });
    }

    return fallbackResult({
      ...fallback,
      status: "ai",
      summary: typeof ai?.summary === "string" ? ai.summary : fallback.summary,
      urgency: ["low", "medium", "high", "critical"].includes(String(ai?.urgency)) ? ai.urgency : fallback.urgency,
      riskScore: Number.isFinite(Number(ai?.riskScore)) ? clamp(Number(ai.riskScore)) : fallback.riskScore,
      confidence: Number.isFinite(Number(ai?.confidence)) ? clamp(Number(ai.confidence), 0, 1) : fallback.confidence,
      groundedFacts: Array.isArray(ai?.groundedFacts) ? ai.groundedFacts.map(String).slice(0, 8) : fallback.groundedFacts,
      reasoning: Array.isArray(ai?.reasoning) ? ai.reasoning.map(String).slice(0, 8) : fallback.reasoning,
      securityWarnings: Array.isArray(ai?.securityWarnings) ? ai.securityWarnings.map(String).slice(0, 8) : fallback.securityWarnings,
      missingEvidence: Array.isArray(ai?.missingEvidence) ? ai.missingEvidence.map(String).slice(0, 8) : fallback.missingEvidence,
      clientFollowUps: Array.isArray(ai?.clientFollowUps) ? ai.clientFollowUps.map(String).slice(0, 8) : fallback.clientFollowUps,
      recommendedActions: Array.isArray(ai?.recommendedActions)
        ? ai.recommendedActions.slice(0, 8).map((action: any, index: number) => ({
            title: String(action?.title ?? fallback.recommendedActions[index]?.title ?? "Review required"),
            reason: String(action?.reason ?? fallback.recommendedActions[index]?.reason ?? "Review the linked record."),
            priority: ["low", "medium", "high", "critical"].includes(String(action?.priority)) ? action.priority : fallback.recommendedActions[index]?.priority ?? "medium",
            entityType: String(action?.entityType ?? fallback.recommendedActions[index]?.entityType ?? "Matter"),
            entityId: String(action?.entityId ?? fallback.recommendedActions[index]?.entityId ?? "unknown"),
            href: String(action?.href ?? fallback.recommendedActions[index]?.href ?? "/app/overview")
          }))
        : fallback.recommendedActions
    });
  } catch (error) {
    if (audit?.workspaceId) {
      await auditEvent({
        workspaceId: audit.workspaceId,
        userId: audit.userId,
        entityType: "AI",
        entityId: audit.entityId ?? audit.feature,
        action: "ai.failed",
        metadata: { feature: audit.feature, error: error instanceof Error ? error.message : String(error) }
      });
    }
    return fallback;
  }
}

async function getScopedMatterBundle(workspaceId: string, user: ScopedUser) {
  const matterWhere = scopedMatterWhere(user);
  const canSeeTeam = canManageTeam(user) || hasFirmWideAccess(user) || hasTeamOversight(user);

  const [matters, draftFields, tasks, appointments, auditEvents, users] = await Promise.all([
    prisma.matter.findMany({
      where: matterWhere,
      include: {
        client: true,
        assignedToUser: true,
        validationIssues: { where: { resolutionStatus: { in: [ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS] } } },
        checklistItems: true,
        documentRequests: true,
        intakeRequests: true,
        impacts: { include: { officialUpdate: true }, where: { status: { in: ["NEW", "REVIEWING"] } } },
        reviewRequests: true
      },
      orderBy: [{ readinessScore: "asc" }, { updatedAt: "desc" }],
      take: 40
    }),
    prisma.matterDraftField.findMany({
      where: {
        draft: { matter: matterWhere },
        status: { in: [DraftFieldStatus.NEEDS_REVIEW, DraftFieldStatus.CONFLICTING, DraftFieldStatus.MISSING] }
      },
      include: {
        templateField: true,
        draft: { include: { matter: { include: { client: true } } } }
      },
      take: 50,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.task.findMany({
      where: { workspaceId, matter: matterWhere, status: { not: TaskStatus.DONE } },
      include: { matter: { include: { client: true } }, assignedToUser: true },
      orderBy: { dueDate: "asc" },
      take: 50
    }),
    prisma.appointment.findMany({
      where: { workspaceId, matter: matterWhere, startsAt: { gte: new Date() } },
      include: { matter: { include: { client: true } }, assignedToUser: true },
      orderBy: { startsAt: "asc" },
      take: 20
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        createdAt: { gte: new Date(Date.now() - 14 * 86400000) },
        action: { in: ["access.denied", "permission.changed", "exported", "document.downloaded"] }
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 40
    }),
    canSeeTeam
      ? prisma.user.findMany({
          where: { workspaceId },
          include: {
            _count: { select: { mattersAssigned: true, tasksAssigned: true, uploadedDocuments: true, clientsAssigned: true } }
          },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([])
  ]);

  return { matters, draftFields, tasks, appointments, auditEvents, users, canSeeTeam };
}

export async function generateDailyBriefing(workspaceId: string, user: ScopedUser): Promise<OverviewIntelligence> {
  const { matters, draftFields, tasks, appointments, auditEvents, users, canSeeTeam } = await getScopedMatterBundle(workspaceId, user);
  const retrieval = await retrieveRelevantContext({ workspaceId, query: "recent official updates and visa knowledge", limit: 4 });

  const blockedMatters = matters.filter((matter) => matter.readinessScore < 60 || matter.validationIssues.length >= 2);
  const overdueRequests = matters.flatMap((matter) =>
    matter.documentRequests.filter((request) => request.status !== "COMPLETED" && request.dueDate && request.dueDate < new Date()).map((request) => ({ matter, request }))
  );
  const missingChecklist = matters.flatMap((matter) => matter.checklistItems.filter((item) => item.required && !item.documentId).map((item) => ({ matter, item })));
  const pendingIntakes = matters.flatMap((matter) => matter.intakeRequests.filter((request) => ["SENT", "VIEWED", "SUBMITTED"].includes(request.status)).map((request) => ({ matter, request })));
  const reviewPending = draftFields.slice(0, 12);
  const lowReadiness = matters.filter((matter) => matter.readinessScore < 70);
  const visaExpiries = matters.filter((matter) => {
    const days = daysUntil(matter.currentVisaExpiry);
    return days !== null && days <= 30;
  });
  const updateImpacts = matters.flatMap((matter) => matter.impacts.map((impact) => ({ matter, impact })));

  const actions: AriaIntelligenceAction[] = [
    ...blockedMatters.slice(0, 3).map((matter): AriaIntelligenceAction => ({
      title: `Resolve blocked matter: ${matter.client.firstName} ${matter.client.lastName}`,
      reason: `${matter.validationIssues.length} open validation issue(s) and readiness ${matter.readinessScore}% require intervention.`,
      priority: matter.readinessScore < 45 ? "critical" : "high",
      entityType: "Matter",
      entityId: matter.id,
      href: `/app/matters/${matter.id}/draft`
    })),
    ...overdueRequests.slice(0, 2).map(({ matter, request }): AriaIntelligenceAction => ({
      title: `Follow up overdue document request`,
      reason: `${matter.client.firstName} ${matter.client.lastName} still has overdue evidence requested for this matter.`,
      priority: "high" as Priority,
      entityType: "DocumentRequest",
      entityId: request.id,
      href: `/app/document-requests/${request.id}`
    })),
    ...visaExpiries.slice(0, 2).map((matter): AriaIntelligenceAction => ({
      title: `Check approaching visa expiry`,
      reason: `${matter.client.firstName} ${matter.client.lastName} has a current visa expiring in ${Math.max(daysUntil(matter.currentVisaExpiry) ?? 0, 0)} day(s).`,
      priority: (daysUntil(matter.currentVisaExpiry) ?? 999) <= 7 ? "critical" : "high",
      entityType: "Matter",
      entityId: matter.id,
      href: `/app/matters/${matter.id}`
    })),
    ...reviewPending.slice(0, 2).map((field): AriaIntelligenceAction => ({
      title: `Review draft field: ${field.templateField.label}`,
      reason: `${field.draft.matter.client.firstName} ${field.draft.matter.client.lastName} still has source-linked draft fields requiring review.`,
      priority: field.status === DraftFieldStatus.CONFLICTING ? "high" : "medium",
      entityType: "MatterDraftField",
      entityId: field.id,
      href: `/app/matters/${field.draft.matterId}/draft`
    }))
  ];

  const securityWarnings = normalizeLines([
    auditEvents.some((event) => event.action === "access.denied") ? `${auditEvents.filter((event) => event.action === "access.denied").length} recent access-denied attempt(s) were logged.` : "",
    auditEvents.some((event) => event.action === "exported") ? `${auditEvents.filter((event) => event.action === "exported").length} recent export/download action(s) were logged.` : "",
    canSeeTeam && users.some((member: any) => member.status === UserStatus.INVITED && member.inviteExpiresAt && member.inviteExpiresAt < new Date())
      ? "One or more invited staff users have stale or expired invite state."
      : "",
    canSeeTeam && users.some((member: any) => member.role !== UserRole.COMPANY_OWNER && permissionCount(member) >= 9)
      ? "A staff user has a very broad permission set and should be reviewed."
      : ""
  ]);

  const workload = canSeeTeam
    ? users.map((member: any) => {
        const memberMatterIds = matters.filter((matter) => matter.assignedToUserId === member.id).map((matter) => matter.id);
        return {
          userId: member.id,
          name: member.name,
          role: roleLabel(member.role),
          activeMatters: member._count.mattersAssigned,
          openTasks: tasks.filter((task) => task.assignedToUserId === member.id).length,
          pendingReviews: reviewPending.filter((field) => memberMatterIds.includes(field.draft.matterId)).length,
          stalledMatters: matters.filter((matter) => matter.assignedToUserId === member.id && matter.readinessScore < 60).length
        };
      })
    : [{
        userId: user.id,
        name: "My workload",
        role: roleLabel(user.role),
        activeMatters: matters.length,
        openTasks: tasks.length,
        pendingReviews: reviewPending.length,
        stalledMatters: blockedMatters.length
      }];

  const groundedFacts = normalizeLines([
    `${blockedMatters.length} visible matter(s) are blocked or low-readiness.`,
    `${pendingIntakes.length} intake request(s) still need client completion or review.`,
    `${overdueRequests.length} document request(s) are overdue.`,
    `${missingChecklist.length} required checklist item(s) still have no linked document.`,
    `${reviewPending.length} draft field(s) remain missing, conflicting, or review-required.`,
    `${appointments.length} upcoming appointment(s) are scheduled in your visible scope.`,
    `${updateImpacts.length} official update impact(s) are currently flagged.`,
    retrieval.results[0] ? `Latest relevant stored knowledge: ${retrieval.results[0].content.slice(0, 120)}.` : ""
  ]);

  const riskScore = clamp(
    blockedMatters.length * 14 +
    overdueRequests.length * 9 +
    missingChecklist.length * 2 +
    reviewPending.length * 2 +
    securityWarnings.length * 12 +
    visaExpiries.length * 10 +
    updateImpacts.length * 5
  );

  const fallback = fallbackResult({
    summary: actions.length
      ? `${actions.length} priority action(s) need attention, led by blocked matters, follow-up queues, and review-required evidence work.`
      : "No urgent blockers are visible in your current scope. Continue with scheduled reviews, follow-ups, and source-linked evidence checks.",
    urgency: toPriority(riskScore),
    riskScore,
    confidence: 0.8,
    groundedFacts,
    reasoning: normalizeLines([
      blockedMatters.length ? "Blocked and low-readiness matters should move first because they directly slow submission readiness." : "No heavily blocked matter is visible right now.",
      overdueRequests.length ? "Overdue document requests are creating avoidable evidence gaps and client drag." : "",
      securityWarnings.length ? "Recent access or export signals need owner/admin review before expanding access further." : "",
      updateImpacts.length ? "Official update impacts should be reviewed before relying on current checklist or readiness assumptions." : ""
    ]),
    recommendedActions: actions,
    securityWarnings,
    missingEvidence: missingChecklist.slice(0, 6).map(({ matter, item }) => `${matter.client.firstName} ${matter.client.lastName}: ${item.label}`),
    clientFollowUps: normalizeLines([
      ...pendingIntakes.slice(0, 3).map(({ matter }) => `Follow up with ${matter.client.firstName} ${matter.client.lastName} to complete the intake questionnaire.`),
      ...overdueRequests.slice(0, 3).map(({ matter }) => `Remind ${matter.client.firstName} ${matter.client.lastName} to upload the overdue requested documents.`)
    ]),
    citations: [
      { label: "Overview", href: "/app/overview" },
      { label: "Validation", href: "/app/validation" },
      { label: "Document Requests", href: "/app/document-requests" },
      { label: "Updates", href: "/app/updates" },
      ...retrieval.results.slice(0, 2).map((result: { label: string; href: string }) => ({ label: result.label, href: result.href }))
    ]
  });

  const result = await maybeAiRefine(
    `You are Aria, an aggressive but careful migration operations intelligence engine. Return strict JSON with keys summary, urgency, riskScore, confidence, groundedFacts, reasoning, recommendedActions, securityWarnings, missingEvidence, clientFollowUps. Do not give legal conclusions. Always require review.`,
    "Generate the firm's daily migration briefing from the supplied operational facts.",
    {
      userRole: user.role,
      assignmentScope: hasFirmWideAccess(user) ? "firm-wide" : hasTeamOversight(user) ? "team-overview" : "assigned-only",
      facts: groundedFacts,
      workload,
      actions
    },
    fallback,
    { workspaceId, userId: user.id, feature: "daily-briefing" }
  );

  await auditEvent({
    workspaceId,
    userId: user.id,
    entityType: "AI",
    entityId: workspaceId,
    action: "daily_briefing.generated",
    metadata: { urgency: result.urgency, riskScore: result.riskScore }
  });

  return {
    ...result,
    urgentActions: actions.slice(0, 6),
    followUps: actions.filter((action) => action.entityType === "DocumentRequest" || action.entityType === "MatterDraftField").slice(0, 6),
    riskWarningsDetailed: updateImpacts.slice(0, 6).map(({ matter, impact }) => ({
      title: impact.officialUpdate.title,
      reason: `${matter.client.firstName} ${matter.client.lastName}: ${impact.reason}`,
      priority: "medium",
      entityType: "OfficialUpdate",
      entityId: impact.officialUpdateId,
      href: `/app/updates/${impact.officialUpdateId}`
    })),
    recommendedOrder: result.recommendedActions.slice(0, 5).map((action) => action.title),
    workload,
    topUrgentActions: result.recommendedActions.slice(0, 5)
  };
}

export async function generateMatterIntelligence(matterId: string, user: ScopedUser): Promise<MatterIntelligence> {
  const matter = await prisma.matter.findFirst({
    where: { id: matterId, ...scopedMatterWhere(user) },
    include: {
      client: true,
      assignedToUser: true,
      documents: { orderBy: { createdAt: "desc" } },
      checklistItems: { include: { document: true }, orderBy: { label: "asc" } },
      validationIssues: { orderBy: [{ severity: "desc" }, { createdAt: "desc" }] },
      impacts: { include: { officialUpdate: true }, orderBy: { createdAt: "desc" } },
      documentRequests: { orderBy: { createdAt: "desc" } },
      intakeRequests: { orderBy: { createdAt: "desc" } },
      timelineEvents: { orderBy: { createdAt: "desc" }, take: 10 },
      reviewRequests: { orderBy: { createdAt: "desc" } },
      appointments: { orderBy: { startsAt: "asc" } }
    }
  });

  if (!matter || !canAccessMatter(user, matter)) {
    return {
      ...fallbackResult({
        summary: "Matter intelligence is unavailable because this matter is outside your scope.",
        urgency: "medium",
        riskScore: 50,
        confidence: 0.7,
        groundedFacts: [],
        reasoning: ["Matter access is restricted by workspace boundary, role, or assignment scope."],
        recommendedActions: [],
        securityWarnings: ["Matter access is restricted."],
        missingEvidence: [],
        clientFollowUps: []
      }),
      matterHealth: "Unavailable",
      nextBestAction: "Check assignment scope before trying again.",
      clientFollowUpSuggestion: "No follow-up can be suggested for an inaccessible matter.",
      finalReviewNote: "Review-required intelligence cannot be generated for inaccessible matters.",
      draftWeaknesses: [],
      evidenceGaps: [],
      riskWarnings: ["Matter access is restricted."]
    };
  }

  let draftWeaknesses: string[] = [];
  let readinessNote = "Draft workflow data is not yet available for this subclass.";
  let openDraftIssues = 0;

  if (matter.visaSubclass === "500") {
    const draft = await getDraftReviewData(matter.id);
    draftWeaknesses = draft.draft.fields
      .filter((field: any) => [DraftFieldStatus.MISSING, DraftFieldStatus.NEEDS_REVIEW, DraftFieldStatus.CONFLICTING].includes(field.status))
      .map((field: any) => `${field.templateField.label} is ${field.status.toLowerCase().replaceAll("_", " ")}.`)
      .slice(0, 8);
    openDraftIssues = draft.openIssues.length;
    readinessNote = `Draft readiness is ${draft.draft.readinessScore}% with ${draft.openIssues.length} open issue(s).`;
  }

  const unresolvedIssues = matter.validationIssues.filter((issue) => issue.resolutionStatus !== ResolutionStatus.RESOLVED && issue.resolutionStatus !== ResolutionStatus.DISMISSED);
  const missingEvidence = matter.checklistItems.filter((item) => item.required && !item.documentId).map((item) => item.label);
  const overdueRequest = matter.documentRequests.find((request) => request.status !== "COMPLETED" && request.dueDate && request.dueDate < new Date());
  const expiryDays = daysUntil(matter.currentVisaExpiry);
  const deadlineDays = daysUntil(matter.criticalDeadline);
  const stalledTimeline = matter.timelineEvents[0] && Date.now() - new Date(matter.timelineEvents[0].createdAt).getTime() > 10 * 86400000;

  const riskScore = clamp(
    (100 - matter.readinessScore) +
    unresolvedIssues.length * 10 +
    missingEvidence.length * 8 +
    openDraftIssues * 6 +
    (overdueRequest ? 10 : 0) +
    (expiryDays !== null && expiryDays <= 30 ? 15 : 0) +
    (deadlineDays !== null && deadlineDays <= 21 ? 15 : 0) +
    matter.impacts.length * 6 +
    (stalledTimeline ? 8 : 0)
  );

  const matterHealth =
    riskScore >= 75 ? "At risk and needs intervention" :
    riskScore >= 50 ? "Progressing but blocked in places" :
    "Stable with review still required";

  const nextBestAction = unresolvedIssues[0]
    ? `Resolve ${unresolvedIssues[0].title}`
    : missingEvidence[0]
      ? `Collect ${missingEvidence[0]}`
      : overdueRequest
        ? "Send a document follow-up before the evidence gap widens."
        : "Run final cross-check after confirming the remaining source-linked review items.";

  const clientFollowUpSuggestion = overdueRequest
    ? `Ask ${matter.client.firstName} to upload the overdue requested evidence and confirm whether anything has changed since the request was sent.`
    : missingEvidence[0]
      ? `Request ${missingEvidence[0]} from ${matter.client.firstName} before moving deeper into final review.`
      : matter.reviewRequests[0] && ["REVIEW_REQUESTED", "SENT_TO_CLIENT", "VIEWED_BY_CLIENT"].includes(matter.reviewRequests[0].status)
        ? `Follow up with ${matter.client.firstName} about the outstanding review request before relying on final readiness.`
        : `Confirm with ${matter.client.firstName} that all supporting evidence is current before the next submission step.`;

  const citations = [
    { label: "Matter", href: `/app/matters/${matter.id}` },
    { label: "Checklist", href: `/app/matters/${matter.id}/checklist` },
    { label: "Draft review", href: matter.visaSubclass === "500" ? `/app/matters/${matter.id}/draft` : "/app/forms" },
    { label: "Validation", href: "/app/validation" }
  ];

  const fallback = fallbackResult({
    summary: `${matter.client.firstName} ${matter.client.lastName} has readiness ${matter.readinessScore}% and ${unresolvedIssues.length} unresolved validation issue(s). ${readinessNote}`,
    urgency: toPriority(riskScore),
    riskScore,
    confidence: 0.83,
    groundedFacts: normalizeLines([
      `Matter stage: ${matter.stage}.`,
      `Readiness score: ${matter.readinessScore}%.`,
      `${unresolvedIssues.length} unresolved validation issue(s) are open.`,
      `${missingEvidence.length} required checklist item(s) are still missing evidence.`,
      overdueRequest ? "A document request is overdue." : "",
      matter.impacts.length ? `${matter.impacts.length} official update impact(s) are flagged.` : "",
      expiryDays !== null ? `Current visa expires in ${Math.max(expiryDays, 0)} day(s).` : "",
      deadlineDays !== null ? `Critical deadline is in ${Math.max(deadlineDays, 0)} day(s).` : ""
    ]),
    reasoning: normalizeLines([
      unresolvedIssues.length ? "Validation blockers should be cleared before trusting readiness or sending the matter forward." : "",
      missingEvidence.length ? "Missing required evidence is directly lowering submission confidence." : "",
      stalledTimeline ? "The timeline looks stale, which suggests the matter may need follow-up or reassignment." : ""
    ]),
      recommendedActions: normalizeLines([
      nextBestAction,
      overdueRequest ? "Review the overdue document request." : "",
      matter.impacts[0] ? "Review the newest official update impact before relying on current readiness." : ""
    ]).map((text, index): AriaIntelligenceAction => ({
      title: text,
      reason: text,
      priority: index === 0 ? toPriority(riskScore) : "medium",
      entityType: "Matter",
      entityId: matter.id,
      href: index === 0 ? `/app/matters/${matter.id}` : index === 1 ? `/app/document-requests/${overdueRequest?.id}` : `/app/matters/${matter.id}/draft`
    })),
    securityWarnings: [],
    missingEvidence,
    clientFollowUps: [clientFollowUpSuggestion],
    citations
  });

  const result = await maybeAiRefine(
    `You are Aria. Return strict JSON with keys summary, urgency, riskScore, confidence, groundedFacts, reasoning, recommendedActions, securityWarnings, missingEvidence, clientFollowUps. Focus on next-best action, evidence gaps, update impacts, review-required drafting, and timeline bottlenecks.`,
    "Generate matter intelligence from the supplied stored facts.",
    {
      matter: {
        id: matter.id,
        clientName: `${matter.client.firstName} ${matter.client.lastName}`,
        readinessScore: matter.readinessScore,
        stage: matter.stage,
        visaSubclass: matter.visaSubclass
      },
      unresolvedIssues: unresolvedIssues.map((issue) => issue.title),
      missingEvidence,
      draftWeaknesses,
      updateImpacts: matter.impacts.map((impact) => `${impact.officialUpdate.title}: ${impact.reason}`)
    },
    fallback,
    { workspaceId: matter.workspaceId, userId: user.id, feature: "matter-intelligence", entityId: matter.id }
  );

  await auditEvent({
    workspaceId: matter.workspaceId,
    userId: user.id,
    entityType: "Matter",
    entityId: matter.id,
    action: "matter_intelligence.generated",
    metadata: { urgency: result.urgency, riskScore: result.riskScore }
  });

  return {
    ...result,
    matterHealth,
    nextBestAction,
    clientFollowUpSuggestion,
    finalReviewNote: readinessNote,
    draftWeaknesses,
    evidenceGaps: result.missingEvidence,
    riskWarnings: result.securityWarnings
  };
}

export async function generateDocumentIntelligence(documentId: string, user: ScopedUser): Promise<DocumentIntelligence> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspaceId: user.workspaceId, matter: scopedMatterWhere(user) },
    include: {
      matter: { include: { client: true, validationIssues: true } },
      extractionResults: { orderBy: { createdAt: "desc" } },
      extractedFields: { orderBy: { createdAt: "desc" } },
      checklistItems: true,
      draftEvidenceLinks: {
        include: { draftField: { include: { templateField: true } } }
      }
    }
  });

  if (!document) {
    return {
      ...fallbackResult({
      summary: "Document intelligence is unavailable because this document is outside your scope.",
        urgency: "medium",
        riskScore: 45,
        confidence: 0.7,
        groundedFacts: [],
        reasoning: ["Document access is constrained by workspace and matter scope."],
        recommendedActions: [],
        securityWarnings: [],
        missingEvidence: [],
        clientFollowUps: []
      }),
      extractedFieldCount: 0,
      weakOcr: true,
      weakEvidence: ["Document access is outside your current scope."],
      draftLinks: [],
      checklistLinks: []
    };
  }

  const extraction = (document.extractionResults[0]?.extractedJson ?? {}) as Record<string, any>;
  const textPreview = typeof extraction.extractedTextPreview === "string" ? extraction.extractedTextPreview.trim() : "";
  const weakOcr = !textPreview || textPreview.length < 80;
  const classification = await runDocumentPipeline(document.fileName, textPreview);
  const categorySuggestion = classification.classification !== document.category ? classification.classification : undefined;
  const lowConfidenceFields = document.extractedFields.filter((field) => field.confidence < 0.75);
  const draftLinks = document.draftEvidenceLinks.map((link) => link.draftField.templateField.label);
  const checklistLinks = document.checklistItems.map((item) => item.label);
  const extractionWarnings = Array.isArray(extraction.extractionWarnings) ? extraction.extractionWarnings.map(String) : [];

  const missingEvidence = checklistLinks.length ? [] : [`${document.fileName} is not linked to a checklist item yet.`];
  const clientFollowUps = weakOcr || lowConfidenceFields.length
    ? [`If this file is important evidence, ask the client for a clearer scan or a text-searchable version of ${document.fileName}.`]
    : [];
  const riskScore = clamp((weakOcr ? 35 : 0) + lowConfidenceFields.length * 8 + (categorySuggestion ? 10 : 0) + (checklistLinks.length ? 0 : 8));

  const fallback = fallbackResult({
    summary: weakOcr
      ? `${document.fileName} has weak OCR/readability and still needs careful manual review before it is relied on as evidence.`
      : `${document.fileName} has readable extracted content and ${document.extractedFields.length} stored extracted field(s).`,
    urgency: toPriority(riskScore),
    riskScore,
    confidence: clamp(Number(extraction.extractionConfidence ?? 0.72), 0, 1),
    groundedFacts: normalizeLines([
      `Stored category: ${document.category}.`,
      `Extraction provider: ${document.extractionResults[0]?.provider ?? "not recorded"}.`,
      `${document.extractedFields.length} extracted field(s) are stored.`,
      weakOcr ? "OCR/text preview is weak or missing." : "A readable text preview is stored.",
      categorySuggestion ? `Suggested category correction: ${categorySuggestion}.` : ""
    ]),
    reasoning: normalizeLines([
      weakOcr ? "Weak OCR means Aria should not overstate what this file proves." : "",
      lowConfidenceFields.length ? "Low-confidence extracted fields need manual verification before they are mapped deeper into the draft." : "",
      !checklistLinks.length ? "An unlinked document can be harder to track in the evidence package." : ""
    ]),
    recommendedActions: [
      {
        title: categorySuggestion ? `Review category: consider ${categorySuggestion}` : "Review extracted evidence links",
        reason: categorySuggestion ? "The stored category does not fully match the document content signal." : "Confirm the stored checklist and draft links are correct.",
        priority: weakOcr ? "high" : "medium",
        entityType: "Document",
        entityId: document.id,
        href: `/app/documents/${document.id}`
      }
    ],
    securityWarnings: [],
    missingEvidence,
    clientFollowUps,
    citations: [
      { label: "Document", href: `/app/documents/${document.id}` },
      { label: "Matter", href: `/app/matters/${document.matterId}` }
    ]
  });

  const result = await maybeAiRefine(
    `You are Aria. Return strict JSON with keys summary, urgency, riskScore, confidence, groundedFacts, reasoning, recommendedActions, securityWarnings, missingEvidence, clientFollowUps. Focus on OCR quality, extraction confidence, checklist links, draft evidence links, and next document requests if evidence is weak.`,
    "Generate document intelligence from the supplied stored extraction facts.",
    {
      document: {
        id: document.id,
        fileName: document.fileName,
        category: document.category,
        matter: document.matter.title
      },
      extractionWarnings,
      lowConfidenceFields: lowConfidenceFields.map((field) => `${field.fieldLabel}: ${field.fieldValue}`),
      draftLinks,
      checklistLinks
    },
    fallback,
    { workspaceId: document.workspaceId, userId: user.id, feature: "document-intelligence", entityId: document.id }
  );

  await auditEvent({
    workspaceId: document.workspaceId,
    userId: user.id,
    entityType: "Document",
    entityId: document.id,
    action: "document_intelligence.generated",
    metadata: { urgency: result.urgency, riskScore: result.riskScore }
  });

  return {
    ...result,
    extractedFieldCount: document.extractedFields.length,
    weakOcr,
    weakEvidence: normalizeLines([
      ...(weakOcr ? ["OCR/text extraction looks weak or incomplete."] : []),
      ...lowConfidenceFields.map((field) => `${field.fieldLabel} is below strong confidence.`),
      ...extractionWarnings
    ]),
    categorySuggestion,
    draftLinks,
    checklistLinks
  };
}

export async function generateTeamIntelligence(workspaceId: string, user: ScopedUser): Promise<AriaIntelligenceResult> {
  const { matters, tasks, users, canSeeTeam } = await getScopedMatterBundle(workspaceId, user);
  if (!canSeeTeam) {
    return fallbackResult({
      summary: "Team workload intelligence is limited to your own assigned scope.",
      urgency: "low",
      riskScore: 18,
      confidence: 0.86,
      groundedFacts: [`${matters.length} visible matter(s) and ${tasks.length} open task(s) are assigned in your scope.`],
      reasoning: ["Role and assignment controls limit cross-team workload visibility."],
      recommendedActions: [],
      securityWarnings: [],
      missingEvidence: [],
      clientFollowUps: []
    });
  }

  const bottlenecks = users.filter((member: any) => member._count.tasksAssigned >= 8 || member._count.mattersAssigned >= 8);
  const fallback = fallbackResult({
    summary: bottlenecks.length
      ? `${bottlenecks.length} team member(s) may be carrying a heavier workload than the current queue can comfortably support.`
      : "No strong team workload bottleneck is visible in the current data.",
    urgency: bottlenecks.length ? "medium" : "low",
    riskScore: clamp(bottlenecks.length * 18),
    confidence: 0.78,
    groundedFacts: normalizeLines(users.slice(0, 8).map((member: any) => `${member.name}: ${member._count.mattersAssigned} matter(s), ${member._count.tasksAssigned} task(s), ${member._count.clientsAssigned} client(s).`)),
    reasoning: normalizeLines([
      bottlenecks.length ? "High case counts and task queues can slow review quality and client follow-up speed." : "",
      "Use workload views to rebalance assignments before deadlines bunch up."
    ]),
    recommendedActions: bottlenecks.slice(0, 4).map((member: any) => ({
      title: `Review workload for ${member.name}`,
      reason: `${member._count.mattersAssigned} matter(s) and ${member._count.tasksAssigned} task(s) may indicate a bottleneck.`,
      priority: member._count.tasksAssigned >= 10 ? "high" : "medium",
      entityType: "User",
      entityId: member.id,
      href: "/app/team"
    })),
    securityWarnings: [],
    missingEvidence: [],
    clientFollowUps: [],
    citations: [{ label: "Team", href: "/app/team" }, { label: "Tasks", href: "/app/tasks" }]
  });

  return maybeAiRefine(
    `You are Aria. Return strict JSON focused on team workload, bottlenecks, reassignment opportunities, and review-required next steps.`,
    "Generate workload intelligence from the supplied team counts.",
    { users: fallback.groundedFacts, bottlenecks: fallback.recommendedActions },
    fallback,
    { workspaceId, userId: user.id, feature: "team-intelligence" }
  );
}

export async function generateSecurityIntelligence(workspaceId: string, user: ScopedUser): Promise<AriaIntelligenceResult> {
  if (!canManageTeam(user) && !hasFirmWideAccess(user)) {
    return fallbackResult({
      summary: "Security intelligence is restricted to owner/admin style access.",
      urgency: "low",
      riskScore: 15,
      confidence: 0.9,
      groundedFacts: [],
      reasoning: ["Security and permission intelligence is intentionally limited by role."],
      recommendedActions: [],
      securityWarnings: ["Security dashboard access is limited by role and permissions."],
      missingEvidence: [],
      clientFollowUps: []
    });
  }

  const [users, audits] = await Promise.all([
    prisma.user.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
        action: { in: ["access.denied", "permission.changed", "exported", "document.downloaded"] }
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 60
    })
  ]);

  const broadUsers = users.filter((member) => member.role !== UserRole.COMPANY_OWNER && permissionCount(member) >= 9);
  const staleInvites = users.filter((member) => member.status === UserStatus.INVITED && member.inviteExpiresAt && member.inviteExpiresAt < new Date());
  const disabledAttempts = audits.filter((event) => event.action === "access.denied" && event.user?.status === UserStatus.DISABLED);
  const exportEvents = audits.filter((event) => event.action === "exported" || event.action === "document.downloaded");
  const permissionChanges = audits.filter((event) => event.action === "permission.changed");
  const noOwner = !users.some((member) => member.role === UserRole.COMPANY_OWNER && member.status === UserStatus.ACTIVE);
  const securityWarnings = normalizeLines([
    broadUsers.length ? `${broadUsers.length} user(s) currently have broad permission sets that deserve review.` : "",
    staleInvites.length ? `${staleInvites.length} invite(s) are stale or expired.` : "",
    disabledAttempts.length ? `${disabledAttempts.length} access-denied event(s) came from disabled users.` : "",
    exportEvents.length ? `${exportEvents.length} recent export/download action(s) were logged.` : "",
    permissionChanges.length ? `${permissionChanges.length} permission change event(s) were logged recently.` : "",
    noOwner ? "No active company owner is present in this workspace." : ""
  ]);
  const riskScore = clamp(securityWarnings.length * 18 + broadUsers.length * 8 + disabledAttempts.length * 10);

  const fallback = fallbackResult({
    summary: securityWarnings.length
      ? `${securityWarnings.length} security or access warning(s) were found in the recent audit trail and user permissions.`
      : "No major security or access warning is obvious from the recent audit trail.",
    urgency: toPriority(riskScore),
    riskScore,
    confidence: 0.82,
    groundedFacts: normalizeLines([
      `${users.length} user record(s) exist in the workspace.`,
      `${broadUsers.length} user(s) have broad permissions.`,
      `${staleInvites.length} invite(s) are stale or expired.`,
      `${exportEvents.length} recent export/download event(s) were logged.`
    ]),
    reasoning: normalizeLines([
      broadUsers.length ? "Broad permissions outside owner/admin roles increase the chance of accidental overexposure." : "",
      staleInvites.length ? "Stale invited users should be cleaned up before they become a governance gap." : "",
      exportEvents.length ? "Exports and downloads are not bad by themselves, but they deserve periodic review." : ""
    ]),
    recommendedActions: [
      ...broadUsers.slice(0, 3).map((member) => ({
        title: `Review permissions for ${member.name}`,
        reason: "This user has broad access relative to a non-owner role.",
        priority: "high" as Priority,
        entityType: "User",
        entityId: member.id,
        href: "/app/team"
      })),
      ...staleInvites.slice(0, 2).map((member) => ({
        title: `Resolve stale invite for ${member.email}`,
        reason: "Old invite tokens should be resent or deactivated.",
        priority: "medium" as Priority,
        entityType: "User",
        entityId: member.id,
        href: "/app/team"
      }))
    ],
    securityWarnings,
    missingEvidence: [],
    clientFollowUps: [],
    citations: [{ label: "Team", href: "/app/team" }, { label: "Data controls", href: "/app/settings/data" }]
  });

  const result = await maybeAiRefine(
    `You are Aria. Return strict JSON focused on security/access monitoring, not legal advice. Highlight permission breadth, stale invites, access-denied events, exports, and governance gaps.`,
    "Generate security intelligence from the supplied user and audit facts.",
    {
      securityWarnings,
      users: users.map((member) => ({ name: member.name, role: member.role, status: member.status })),
      auditCount: audits.length
    },
    fallback,
    { workspaceId, userId: user.id, feature: "security-intelligence" }
  );

  if (result.securityWarnings.length) {
    await auditEvent({
      workspaceId,
      userId: user.id,
      entityType: "Workspace",
      entityId: workspaceId,
      action: "security_warning.generated",
      metadata: { count: result.securityWarnings.length }
    });
  }

  return result;
}

export async function generateNextBestActions(workspaceId: string, user: ScopedUser): Promise<AriaIntelligenceResult> {
  const briefing = await generateDailyBriefing(workspaceId, user);
  return fallbackResult({
    ...briefing,
    summary: briefing.topUrgentActions.length
      ? `Aria recommends starting with ${briefing.topUrgentActions[0].title.toLowerCase()}, then moving through the next follow-up and risk-control items.`
      : "No urgent action stack is visible. Continue with assigned reviews and scheduled follow-ups.",
    recommendedActions: briefing.topUrgentActions.slice(0, 5)
  });
}

export async function getOverviewIntelligence(workspaceId: string, user: ScopedUser) {
  return generateDailyBriefing(workspaceId, user);
}

export async function getMatterIntelligence(input: { matterId: string; user: ScopedUser }) {
  return generateMatterIntelligence(input.matterId, input.user);
}

export async function getDocumentIntelligence(document: any) {
  const fauxUser = {
    id: document.uploadedByUserId ?? "system",
    workspaceId: document.workspaceId,
    role: UserRole.COMPANY_OWNER,
    visibilityScope: UserVisibilityScope.FIRM_WIDE,
    status: UserStatus.ACTIVE,
    permissionsJson: {}
  } satisfies ScopedUser;
  return generateDocumentIntelligence(document.id, fauxUser);
}
