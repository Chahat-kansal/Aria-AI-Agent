import { UserRole, UserStatus, WorkspacePlan, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getAiConfigStatus,
  getAuthConfigStatus,
  getCronConfigStatus,
  getDatabaseConfigStatus,
  getEmailConfigStatus,
  getEncryptionConfigStatus,
  getOcrConfigStatus,
  getStorageConfigStatus,
  getWebResearchConfigStatus
} from "@/lib/services/runtime-config";
import { getWorkspaceLaunchControls } from "@/lib/services/launch-controls";
import { listSubclassSupport } from "@/lib/services/subclass-support";
import { redactAuditMetadata, redactSensitive } from "@/lib/security/redaction";

export const ADMIN_SUBCLASSES = ["500", "485", "482", "186", "820/801", "309/100", "189", "190", "491", "600"];

export function formatDate(value?: Date | null) {
  return value ? value.toLocaleString("en-AU") : "Not recorded";
}

export function getPlatformRuntimeStatus() {
  return {
    auth: getAuthConfigStatus(),
    database: getDatabaseConfigStatus(),
    directDatabase: { configured: Boolean(process.env.DIRECT_URL), provider: process.env.DIRECT_URL ? "configured" : "not configured", missing: process.env.DIRECT_URL ? [] : ["DIRECT_URL"] },
    ai: getAiConfigStatus(),
    ocr: getOcrConfigStatus(),
    email: getEmailConfigStatus(),
    storage: getStorageConfigStatus(),
    cron: getCronConfigStatus(),
    encryption: getEncryptionConfigStatus(),
    webResearch: getWebResearchConfigStatus(),
    auditLogging: { configured: true, provider: "database audit events", missing: [] },
    clientPortalTokenHashing: { configured: true, provider: "hashed scoped tokens", missing: [] },
    documentProtection: { configured: getEncryptionConfigStatus().configured, provider: "permissioned download routes", missing: getEncryptionConfigStatus().missing }
  };
}

export async function getBuildInfoSummary() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "local";
  return {
    root: "next-prisma-app",
    environment: process.env.NODE_ENV || "development",
    commit,
    vercelUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "Not configured",
    aiConfigured: getAiConfigStatus().configured,
    cronConfigured: getCronConfigStatus().configured,
    encryptionConfigured: getEncryptionConfigStatus().configured
  };
}

export async function getPlatformOverview() {
  const [
    totalWorkspaces,
    totalUsers,
    activeUsers,
    disabledUsers,
    totalMatters,
    totalDocuments,
    auditEvents,
    workspaces
  ] = await Promise.all([
    prisma.workspace.count(),
    prisma.user.count(),
    prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
    prisma.user.count({ where: { status: UserStatus.DISABLED } }),
    prisma.matter.count(),
    prisma.document.count(),
    prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { workspace: true, user: true } }),
    prisma.workspace.findMany({ select: { id: true, plan: true } })
  ]);

  return {
    counts: {
      totalWorkspaces,
      activeWorkspaces: totalWorkspaces,
      trialWorkspaces: workspaces.filter((item) => item.plan === WorkspacePlan.STARTER).length,
      suspendedWorkspaces: 0,
      totalUsers,
      activeUsers,
      disabledUsers,
      totalMatters,
      totalDocuments
    },
    runtime: getPlatformRuntimeStatus(),
    buildInfo: await getBuildInfoSummary(),
    subclassSupport: listSubclassSupport(),
    recentAudit: auditEvents.map(redactedAuditEvent)
  };
}

export async function getWorkspaceRows() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { where: { role: UserRole.COMPANY_OWNER }, take: 1 },
      _count: { select: { users: true, clients: true, matters: true, documents: true, auditEvents: true } },
      operationalSettings: true
    }
  });
  return Promise.all(workspaces.map(async (workspace) => {
    const controls = await getWorkspaceLaunchControls(workspace.id).catch(() => null);
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      plan: workspace.plan,
      billingPlan: workspace.billingPlan,
      subscriptionStatus: workspace.subscriptionStatus,
      billingProvider: workspace.billingProvider,
      billingEmail: workspace.billingEmail,
      stripeCustomerIdPresent: Boolean(workspace.stripeCustomerId),
      stripeSubscriptionIdPresent: Boolean(workspace.stripeSubscriptionId),
      trialEndsAt: workspace.trialEndsAt,
      currentPeriodEnd: workspace.currentPeriodEnd,
      createdAt: workspace.createdAt,
      ownerName: workspace.users[0]?.name ?? "No owner",
      ownerEmail: workspace.users[0]?.email ?? "Not recorded",
      counts: workspace._count,
      launch: controls ? {
        betaModeEnabled: controls.betaModeEnabled,
        allowRealClientUploads: controls.allowRealClientUploads,
        clientPortalEnabled: controls.clientPortalEnabled,
        aiDraftAutofillEnabled: controls.aiDraftAutofillEnabled,
        pdfFormFillingEnabled: controls.pdfFormFillingEnabled,
        exportEnabled: controls.exportEnabled,
        publicSignupEnabled: controls.publicSignupEnabled,
        allowedSubclasses: controls.allowedSubclasses
      } : null
    };
  }));
}

export async function getWorkspaceDetail(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      users: { orderBy: { email: "asc" } },
      _count: { select: { users: true, clients: true, matters: true, documents: true, auditEvents: true, officialFormTemplates: true, invoices: true } },
      operationalSettings: true,
      auditEvents: { orderBy: { createdAt: "desc" }, take: 25, include: { user: true, workspace: true } }
    }
  });
  if (!workspace) return null;
  const controls = await getWorkspaceLaunchControls(workspace.id).catch(() => null);
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan,
    billingPlan: workspace.billingPlan,
    subscriptionStatus: workspace.subscriptionStatus,
    billingProvider: workspace.billingProvider,
    billingEmail: workspace.billingEmail,
    stripeCustomerIdPresent: Boolean(workspace.stripeCustomerId),
    stripeSubscriptionIdPresent: Boolean(workspace.stripeSubscriptionId),
    trialEndsAt: workspace.trialEndsAt,
    currentPeriodEnd: workspace.currentPeriodEnd,
    legalName: workspace.legalName,
    businessType: workspace.businessType,
    contactEmail: workspace.contactEmail,
    createdAt: workspace.createdAt,
    counts: workspace._count,
    users: workspace.users.map(redactedUser),
    controls,
    auditEvents: workspace.auditEvents.map(redactedAuditEvent)
  };
}

export async function getUserRows() {
  const users = await prisma.user.findMany({
    orderBy: [{ workspace: { name: "asc" } }, { email: "asc" }],
    include: { workspace: true }
  });
  return users.map(redactedUser);
}

export async function getAuditRows(where: Prisma.AuditEventWhereInput = {}, take = 100) {
  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { workspace: true, user: true }
  });
  return events.map(redactedAuditEvent);
}

export function redactedUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    workspaceId: user.workspaceId,
    workspaceName: user.workspace?.name ?? undefined,
    visibilityScope: user.visibilityScope,
    invitedAt: user.invitedAt,
    inviteAcceptedAt: user.inviteAcceptedAt,
    lastActiveAt: user.lastActiveAt,
    permissionSummary: summarizePermissions(user.permissionsJson)
  };
}

function summarizePermissions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Default role permissions";
  const enabled = Object.entries(value as Record<string, unknown>).filter(([, item]) => item === true).length;
  const disabled = Object.entries(value as Record<string, unknown>).filter(([, item]) => item === false).length;
  return `${enabled} enabled / ${disabled} disabled`;
}

export function redactedAuditEvent(event: any) {
  return {
    id: event.id,
    createdAt: event.createdAt,
    workspaceId: event.workspaceId,
    workspaceName: event.workspace?.name ?? "Unknown workspace",
    actorEmail: event.user?.email ?? "System",
    actorRole: event.user?.role ?? "SYSTEM",
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    metadata: redactAuditMetadata(event.metadataJson ?? {})
  };
}

export function safeJson(value: unknown) {
  return JSON.stringify(redactSensitive(value), null, 2);
}
