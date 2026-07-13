import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditAccessDenied } from "@/lib/services/audit";
import { scopedMatterWhere } from "@/lib/services/roles";
import {
  MATTER_HEALTH_AGENT_REVIEW_WARNING,
  MATTER_HEALTH_LEGAL_DISCLAIMER,
  MATTER_HEALTH_OUTCOME_DISCLAIMER,
  canAccessMatterHealth,
  matterHealthBand,
  matterHealthBandLabel,
  matterHealthTone,
  type MatterHealthBand
} from "@/lib/services/matter-health/matter-health-policy";
import { redactMatterHealthAuditMetadata, redactMatterHealthBreakdownLabel } from "@/lib/services/matter-health/matter-health-redaction";
import {
  buildMatterHealthSignals,
  matterHealthMatterInclude,
  type MatterHealthLoadedMatter,
  type MatterHealthSignal
} from "@/lib/services/matter-health/matter-health-signals";

export type ScopedMatterHealthUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson" | "email" | "name">;

export type MatterHealthItem = {
  matterId: string;
  matterReference: string | null;
  title: string;
  clientLabel: string;
  visaSubclass: string;
  stageLabel: string;
  score: number;
  band: MatterHealthBand;
  bandLabel: string;
  tone: "info" | "warning" | "critical";
  summary: string;
  reviewRequiredWarning: string;
  legalDisclaimer: string;
  outcomeDisclaimer: string;
  blockers: MatterHealthSignal[];
  missingEvidenceSignals: MatterHealthSignal[];
  overdueActionSignals: MatterHealthSignal[];
  recommendedNextActions: Array<{ title: string; detail: string; route: string | null; priority: "high" | "medium" | "low" }>;
  breakdown: Array<{ label: string; impact: number; tone: "success" | "warning" | "danger" | "info" }>;
  clientResponseStatus: string;
  criticalBlockerCount: number;
  route: string;
  updatedAt: string;
  comparisonToReadiness: { baseline: number; delta: number; label: string };
};

export type MatterHealthDashboard = {
  summary: {
    visibleMatters: number;
    averageScore: number;
    redBand: number;
    amberBand: number;
    greenBand: number;
    criticalBlockers: number;
    overdueActions: number;
  };
  items: MatterHealthItem[];
};

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeClientResponse(item: ReturnType<typeof buildMatterHealthSignals>) {
  if (item.counts.clientResponseLag > 0) return "Client follow-up overdue";
  if (item.counts.pendingConfirmations > 0) return "Awaiting client confirmation";
  return "No client response blockers";
}

function buildRecommendedActions(matter: MatterHealthLoadedMatter, signals: MatterHealthSignal[]) {
  const actions = signals
    .slice()
    .sort((left, right) => right.impact - left.impact)
    .slice(0, 4)
    .map((signal) => ({
      title:
        signal.code === "missing_required_evidence"
          ? "Request and link missing evidence"
          : signal.code === "overdue_deadlines"
            ? "Review overdue deadline timing"
            : signal.code === "critical_validation_issues"
              ? "Resolve critical validation blockers"
              : signal.code === "low_confidence_extraction"
                ? "Verify extracted evidence before use"
                : signal.code === "draft_needs_work"
                  ? "Rework the current application draft"
                  : signal.code === "client_response_lag"
                    ? "Follow up through the secure client portal"
                    : `Review ${signal.label.toLowerCase()}`,
      detail: signal.detail,
      route: signal.route,
      priority: (signal.severity === "critical" ? "high" : signal.severity === "warning" ? "medium" : "low") as "high" | "medium" | "low"
    }));

  if (!actions.length) {
    actions.push({
      title: "Continue review-required workflow checks",
      detail: "No critical blockers are visible right now, but agent review is still required before relying on this matter status.",
      route: `/app/matters/${matter.id}`,
      priority: "low"
    });
  }

  return actions;
}

function buildBreakdown(signals: MatterHealthSignal[], score: number) {
  const rows = signals
    .slice()
    .sort((left, right) => right.impact - left.impact)
    .slice(0, 6)
    .map((signal) => ({
      label: redactMatterHealthBreakdownLabel(signal.label) || signal.label,
      impact: signal.impact,
      tone: signal.severity === "critical" ? "danger" as const : signal.severity === "warning" ? "warning" as const : "info" as const
    }));

  return [{ label: "Starting advisory baseline", impact: 100 - score, tone: "success" as const }, ...rows];
}

export function buildMatterHealthItem(matter: MatterHealthLoadedMatter): MatterHealthItem {
  const signalResult = buildMatterHealthSignals(matter);
  const score = Math.max(0, Math.min(100, 100 - signalResult.totalPenalty));
  const band = matterHealthBand(score);
  const blockers = signalResult.signals.filter((signal) => signal.category === "blocker");
  const missingEvidenceSignals = signalResult.signals.filter((signal) => signal.category === "missing_evidence");
  const overdueActionSignals = signalResult.signals.filter((signal) => signal.category === "overdue_action");
  const comparisonDelta = score - matter.readinessScore;

  return {
    matterId: matter.id,
    matterReference: matter.matterReference || null,
    title: matter.title,
    clientLabel: `${matter.client.firstName} ${matter.client.lastName}`.trim(),
    visaSubclass: matter.visaSubclass,
    stageLabel: formatEnum(matter.stage),
    score,
    band,
    bandLabel: matterHealthBandLabel(band),
    tone: matterHealthTone(band),
    summary:
      signalResult.signals.length > 0
        ? `${matter.title} has ${signalResult.signals.length} active health signal(s). ${MATTER_HEALTH_AGENT_REVIEW_WARNING}.`
        : `${matter.title} currently shows no major health blockers in scoped data. ${MATTER_HEALTH_AGENT_REVIEW_WARNING}.`,
    reviewRequiredWarning: MATTER_HEALTH_AGENT_REVIEW_WARNING,
    legalDisclaimer: MATTER_HEALTH_LEGAL_DISCLAIMER,
    outcomeDisclaimer: MATTER_HEALTH_OUTCOME_DISCLAIMER,
    blockers,
    missingEvidenceSignals,
    overdueActionSignals,
    recommendedNextActions: buildRecommendedActions(matter, signalResult.signals),
    breakdown: buildBreakdown(signalResult.signals, score),
    clientResponseStatus: summarizeClientResponse(signalResult),
    criticalBlockerCount: signalResult.signals.filter((signal) => signal.severity === "critical").length,
    route: `/app/matters/${matter.id}`,
    updatedAt: matter.updatedAt.toISOString(),
    comparisonToReadiness: {
      baseline: matter.readinessScore,
      delta: comparisonDelta,
      label:
        comparisonDelta > 10
          ? "Health score is stronger than submission readiness"
          : comparisonDelta < -10
            ? "Health score shows more operational risk than submission readiness"
            : "Health score is broadly aligned with submission readiness"
    }
  };
}

export async function getMatterHealthDashboard(input: {
  workspaceId: string;
  user: ScopedMatterHealthUser;
  matterId?: string | null;
  band?: MatterHealthBand | null;
}) {
  if (!canAccessMatterHealth(input.user)) {
    await auditAccessDenied({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      entityType: "MatterHealth",
      entityId: input.matterId || undefined,
      reason: "matter_health_access_denied",
      metadata: redactMatterHealthAuditMetadata({ band: input.band || null })
    });
    return null;
  }

  const matters = await prisma.matter.findMany({
    where: {
      ...(scopedMatterWhere(input.user) as Prisma.MatterWhereInput),
      ...(input.matterId ? { id: input.matterId } : {})
    },
    include: matterHealthMatterInclude,
    orderBy: [{ updatedAt: "desc" }],
    take: input.matterId ? 1 : 60
  });

  const items = matters
    .map(buildMatterHealthItem)
    .filter((item) => !input.band || item.band === input.band)
    .sort((left, right) => left.score - right.score);

  return {
    summary: {
      visibleMatters: items.length,
      averageScore: items.length ? Math.round(items.reduce((total, item) => total + item.score, 0) / items.length) : 0,
      redBand: items.filter((item) => item.band === "red").length,
      amberBand: items.filter((item) => item.band === "amber").length,
      greenBand: items.filter((item) => item.band === "green").length,
      criticalBlockers: items.reduce((total, item) => total + item.criticalBlockerCount, 0),
      overdueActions: items.reduce((total, item) => total + item.overdueActionSignals.reduce((sum, signal) => sum + signal.count, 0), 0)
    },
    items
  } satisfies MatterHealthDashboard;
}

export async function getMatterHealthForMatter(input: {
  workspaceId: string;
  matterId: string;
  user: ScopedMatterHealthUser;
}) {
  const dashboard = await getMatterHealthDashboard({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    user: input.user
  });
  if (!dashboard?.items.length) return null;
  return dashboard.items[0];
}

export async function getMatterHealthPlatformSummary(workspaceId: string) {
  const matters = await prisma.matter.findMany({
    where: { workspaceId },
    include: {
      validationIssues: {
        where: { resolutionStatus: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { id: true, severity: true }
      },
      checklistItems: { select: { id: true, required: true, documentId: true } },
      deadlines: { where: { status: "OPEN" as any }, select: { id: true, dueAt: true } }
    },
    take: 100
  });

  const summaries = matters.map((matter) => {
    const openIssues = matter.validationIssues.length;
    const missingEvidence = matter.checklistItems.filter((item) => item.required && !item.documentId).length;
    const overdueDeadlines = matter.deadlines.filter((deadline) => deadline.dueAt.getTime() < Date.now()).length;
    const score = Math.max(0, Math.min(100, matter.readinessScore - openIssues * 4 - missingEvidence * 6 - overdueDeadlines * 8));
    return {
      score,
      band: matterHealthBand(score),
      openIssues,
      missingEvidence,
      overdueDeadlines
    };
  });

  return {
    visibleMatters: summaries.length,
    averageScore: summaries.length ? Math.round(summaries.reduce((total, item) => total + item.score, 0) / summaries.length) : 0,
    redBand: summaries.filter((item) => item.band === "red").length,
    amberBand: summaries.filter((item) => item.band === "amber").length,
    greenBand: summaries.filter((item) => item.band === "green").length,
    openIssues: summaries.reduce((total, item) => total + item.openIssues, 0),
    missingEvidence: summaries.reduce((total, item) => total + item.missingEvidence, 0),
    overdueDeadlines: summaries.reduce((total, item) => total + item.overdueDeadlines, 0)
  };
}
