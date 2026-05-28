import { prisma } from "@/lib/prisma";
import { getAnalyticsProviderStatus } from "@/lib/providers/analytics-provider";
import { getEmailProviderStatus } from "@/lib/providers/email-provider";
import { getOcrProviderStatus } from "@/lib/providers/ocr-provider";
import { getPaymentProviderStatus } from "@/lib/providers/payment-provider";
import { getSmsProviderStatus } from "@/lib/providers/sms-provider";
import { getWorkspaceLaunchControls } from "@/lib/services/launch-controls";
import { getSubclassSupportSummary } from "@/lib/services/subclass-support";

const PRODUCTIVITY_ACTIONS = {
  documentsProcessed: ["document.uploaded", "portal.document_uploaded"],
  draftsGenerated: ["ai.used"],
  portalInvitesSent: ["portal.link.create", "portal.used", "portal.session_used"],
  confirmationsCompleted: ["client_confirmation.submitted", "portal.acknowledgement.created"],
  remindersSent: ["provider.email.sent", "provider.sms.sent", "provider.email.test_success", "provider.sms.test_success"],
  pathwayAnalyses: ["pathway.generate"],
  invoicesCreated: ["invoice.created"]
} as const;

export type BetaChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  detail: string;
};

export type WorkspaceBetaSnapshot = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  betaModeEnabled: boolean;
  allowRealClientUploads: boolean;
  launchControlsSummary: {
    clientPortalEnabled: boolean;
    aiDraftAutofillEnabled: boolean;
    pdfFormFillingEnabled: boolean;
    allowedSubclasses: string[];
  };
  onboardingChecklist: BetaChecklistItem[];
  valueMetrics: {
    activeMatters: number;
    documentsProcessed: number;
    draftsGenerated: number;
    portalInvitesSent: number;
    confirmationsCompleted: number;
    remindersSent: number;
    pathwayAnalyses: number;
    invoicesCreated: number;
    blockerCount: number;
    estimatedHoursSaved: number;
  };
  providerReadiness: {
    emailConfigured: boolean;
    smsConfigured: boolean;
    ocrConfigured: boolean;
    billingConfigured: boolean;
    analyticsConfigured: boolean;
  };
};

function countActions(actions: string[], samples: Array<{ action: string }>) {
  return samples.filter((sample) => actions.includes(sample.action)).length;
}

function estimatedHoursSaved(metrics: {
  documentsProcessed: number;
  draftsGenerated: number;
  confirmationsCompleted: number;
  pathwayAnalyses: number;
  remindersSent: number;
}) {
  return Number((
    metrics.documentsProcessed * 0.08
    + metrics.draftsGenerated * 0.2
    + metrics.confirmationsCompleted * 0.06
    + metrics.pathwayAnalyses * 0.15
    + metrics.remindersSent * 0.03
  ).toFixed(1));
}

export async function getWorkspaceBetaSnapshot(workspaceId: string): Promise<WorkspaceBetaSnapshot> {
  const [workspace, controls, matters, audits, issues] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { _count: { select: { matters: true, clients: true, documents: true } } }
    }),
    getWorkspaceLaunchControls(workspaceId),
    prisma.matter.findMany({
      where: { workspaceId },
      select: { id: true, visaSubclass: true, readinessScore: true }
    }),
    prisma.auditEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { action: true }
    }),
    prisma.validationIssue.count({
      where: {
        matter: { workspaceId },
        resolutionStatus: { in: ["OPEN", "IN_PROGRESS"] }
      }
    })
  ]);

  const metrics = {
    activeMatters: matters.length,
    documentsProcessed: countActions([...PRODUCTIVITY_ACTIONS.documentsProcessed], audits),
    draftsGenerated: countActions([...PRODUCTIVITY_ACTIONS.draftsGenerated], audits),
    portalInvitesSent: countActions([...PRODUCTIVITY_ACTIONS.portalInvitesSent], audits),
    confirmationsCompleted: countActions([...PRODUCTIVITY_ACTIONS.confirmationsCompleted], audits),
    remindersSent: countActions([...PRODUCTIVITY_ACTIONS.remindersSent], audits),
    pathwayAnalyses: countActions([...PRODUCTIVITY_ACTIONS.pathwayAnalyses], audits),
    invoicesCreated: countActions([...PRODUCTIVITY_ACTIONS.invoicesCreated], audits),
    blockerCount: issues
  };

  const providerReadiness = {
    emailConfigured: getEmailProviderStatus().configured,
    smsConfigured: getSmsProviderStatus().configured,
    ocrConfigured: getOcrProviderStatus().configured,
    billingConfigured: getPaymentProviderStatus().configured,
    analyticsConfigured: getAnalyticsProviderStatus().configured
  };

  const onboardingChecklist: BetaChecklistItem[] = [
    {
      key: "beta_mode",
      label: "Beta mode enabled",
      done: controls.betaModeEnabled,
      detail: controls.betaModeEnabled ? "Workspace is still gated for controlled beta." : "Workspace is not marked as beta-controlled."
    },
    {
      key: "client_portal",
      label: "Client portal enabled",
      done: controls.clientPortalEnabled,
      detail: controls.clientPortalEnabled ? "Secure client portal can be used for invited clients." : "Portal access is currently disabled."
    },
    {
      key: "core_subclasses",
      label: "Core subclass set allowed",
      done: controls.allowedSubclasses.length >= 4,
      detail: `${controls.allowedSubclasses.length} subclass or workflow code(s) enabled in launch controls.`
    },
    {
      key: "email",
      label: "Email delivery configured",
      done: providerReadiness.emailConfigured,
      detail: providerReadiness.emailConfigured ? "Email provider is configured." : "Secure manual fallback is still required."
    },
    {
      key: "billing",
      label: "Billing provider configured",
      done: providerReadiness.billingConfigured,
      detail: providerReadiness.billingConfigured ? "Billing configuration is present." : "Workspace billing is not configured yet."
    },
    {
      key: "ocr",
      label: "OCR/photo extraction configured",
      done: providerReadiness.ocrConfigured,
      detail: providerReadiness.ocrConfigured ? "Photo OCR is configured." : "Photo extraction should be presented as unavailable."
    },
    {
      key: "documents",
      label: "Dummy document activity recorded",
      done: metrics.documentsProcessed > 0,
      detail: metrics.documentsProcessed > 0 ? `${metrics.documentsProcessed} document upload event(s) recorded.` : "No document processing events recorded yet."
    },
    {
      key: "drafts",
      label: "Draft generation activity recorded",
      done: metrics.draftsGenerated > 0,
      detail: metrics.draftsGenerated > 0 ? `${metrics.draftsGenerated} AI draft event(s) recorded.` : "No draft-generation activity recorded yet."
    }
  ];

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    betaModeEnabled: controls.betaModeEnabled,
    allowRealClientUploads: controls.allowRealClientUploads,
    launchControlsSummary: {
      clientPortalEnabled: controls.clientPortalEnabled,
      aiDraftAutofillEnabled: controls.aiDraftAutofillEnabled,
      pdfFormFillingEnabled: controls.pdfFormFillingEnabled,
      allowedSubclasses: controls.allowedSubclasses
    },
    onboardingChecklist,
    valueMetrics: {
      ...metrics,
      estimatedHoursSaved: estimatedHoursSaved(metrics)
    },
    providerReadiness
  };
}

export async function getPlatformBetaSnapshot() {
  const [workspaces, totalAuditEvents] = await Promise.all([
    prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, slug: true, plan: true }
    }),
    prisma.auditEvent.count()
  ]);

  const subclassSummary = getSubclassSupportSummary();
  const workspaceSnapshots = await Promise.all(
    workspaces.map(async (workspace) => getWorkspaceBetaSnapshot(workspace.id))
  );

  return {
    generatedAt: new Date().toISOString(),
    totalAuditEvents,
    subclassSummary,
    workspaces: workspaceSnapshots,
    providerReadiness: {
      email: getEmailProviderStatus(),
      sms: getSmsProviderStatus(),
      ocr: getOcrProviderStatus(),
      billing: getPaymentProviderStatus(),
      analytics: getAnalyticsProviderStatus()
    }
  };
}
