import { MatterStage, MatterStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import { getEmailSyncProviderStatus, type EmailSyncConnectionContext } from "@/lib/providers/email-sync-provider";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { getAuditRows, safeJson } from "@/lib/services/platform-admin-data";
import { auditEvent } from "@/lib/services/audit";
import { disconnectEmailSyncProvider } from "@/lib/services/email-sync/email-sync-oauth";
import { getEmailSyncProviderAdapter } from "@/lib/services/email-sync/email-sync-integration";
import {
  buildEmailSyncTemplate,
  assertSafeEmailPayload,
  buildSecurePortalLoginLink
} from "@/lib/services/email-sync/email-sync-safety";
import {
  getMatterEmailWorkspace,
  linkMatterEmailThread,
  sendMatterClientEmail
} from "@/lib/services/email-sync/matter-email-linking";
import {
  decryptStoredProviderToken,
  getWorkspaceProviderConnection,
  upsertWorkspaceProviderConnection
} from "@/lib/services/oauth-token-vault";

loadScriptEnv();

type Check = { name: string; pass: boolean; detail?: string };

const WORKSPACE_SLUG = "email-sync-readiness";

function setEnv(overrides: Record<string, string | undefined>) {
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  });
  return () => {
    Object.entries(previous).forEach(([key, value]) => {
      if (typeof value === "undefined") delete process.env[key];
      else process.env[key] = value;
    });
  };
}

async function seedWorkspace() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Email Sync Readiness", plan: WorkspacePlan.PRO },
    create: { slug: WORKSPACE_SLUG, name: "Email Sync Readiness", plan: WorkspacePlan.PRO }
  });

  const agentA = await prisma.user.upsert({
    where: { email: "email-sync-agent-a@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Email Sync Agent A",
      email: "email-sync-agent-a@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const agentB = await prisma.user.upsert({
    where: { email: "email-sync-agent-b@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Email Sync Agent B",
      email: "email-sync-agent-b@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const clientA = await prisma.client.upsert({
    where: { clientReference: "EMAIL-READY-A" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agentA.id,
      email: "email-sync-client-a@example.com"
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "EMAIL-READY-A",
      firstName: "Email",
      lastName: "Client A",
      dob: new Date("1991-01-01T00:00:00.000Z"),
      nationality: "Test",
      email: "email-sync-client-a@example.com",
      phone: "0400000101",
      assignedToUserId: agentA.id
    }
  });

  const clientB = await prisma.client.upsert({
    where: { clientReference: "EMAIL-READY-B" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agentB.id,
      email: "email-sync-client-b@example.com"
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "EMAIL-READY-B",
      firstName: "Email",
      lastName: "Client B",
      dob: new Date("1992-01-01T00:00:00.000Z"),
      nationality: "Test",
      email: "email-sync-client-b@example.com",
      phone: "0400000102",
      assignedToUserId: agentB.id
    }
  });

  const matterA = await prisma.matter.upsert({
    where: { matterReference: "EMAIL-READY-MATTER-A" },
    update: { workspaceId: workspace.id, clientId: clientA.id, assignedToUserId: agentA.id },
    create: {
      workspaceId: workspace.id,
      matterReference: "EMAIL-READY-MATTER-A",
      clientId: clientA.id,
      assignedToUserId: agentA.id,
      title: "Email Readiness Matter A",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 41
    }
  });

  const matterB = await prisma.matter.upsert({
    where: { matterReference: "EMAIL-READY-MATTER-B" },
    update: { workspaceId: workspace.id, clientId: clientB.id, assignedToUserId: agentB.id },
    create: {
      workspaceId: workspace.id,
      matterReference: "EMAIL-READY-MATTER-B",
      clientId: clientB.id,
      assignedToUserId: agentB.id,
      title: "Email Readiness Matter B",
      visaSubclass: "482",
      visaStream: "Sponsored",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 38
    }
  });

  await prisma.matterEmailMessage.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.matterEmailThread.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.emailSyncEvent.deleteMany({ where: { workspaceId: workspace.id } });

  return { workspace, agentA, agentB, clientA, clientB, matterA, matterB };
}

async function main() {
  const checks: Check[] = [];
  const seeded = await seedWorkspace();
  const context: EmailSyncConnectionContext = {
    workspaceId: seeded.workspace.id,
    userId: seeded.agentA.id,
    provider: "gmail"
  };

  const restoreDisabled = setEnv({ EMAIL_SYNC_PROVIDER: "disabled" });
  const disabledStatus = getEmailSyncProviderStatus();
  checks.push({
    name: "Disabled provider state passes honestly",
    pass: disabledStatus.state === "disabled" && /not configured/i.test(disabledStatus.disabledReason || "")
  });
  restoreDisabled();

  const restoreGmailMissing = setEnv({
    EMAIL_SYNC_PROVIDER: "gmail",
    GMAIL_CLIENT_ID: "",
    GMAIL_CLIENT_SECRET: "",
    GMAIL_REDIRECT_URI: ""
  });
  const gmailMissing = getEmailSyncProviderStatus();
  checks.push({
    name: "Gmail config missing state is clear",
    pass: gmailMissing.state === "not_configured" && gmailMissing.missingEnv.includes("GMAIL_CLIENT_ID")
  });
  restoreGmailMissing();

  const restoreMicrosoftMissing = setEnv({
    EMAIL_SYNC_PROVIDER: "microsoft",
    MICROSOFT_EMAIL_CLIENT_ID: "",
    MICROSOFT_EMAIL_CLIENT_SECRET: "",
    MICROSOFT_EMAIL_TENANT_ID: "common",
    MICROSOFT_EMAIL_REDIRECT_URI: ""
  });
  const microsoftMissing = getEmailSyncProviderStatus();
  checks.push({
    name: "Microsoft config missing state is clear",
    pass: microsoftMissing.state === "not_configured" && microsoftMissing.missingEnv.includes("MICROSOFT_EMAIL_CLIENT_ID")
  });
  restoreMicrosoftMissing();

  checks.push({
    name: "OAuth token storage uses encrypted token vault path",
    pass: /upsertWorkspaceProviderConnection/.test(readFileSync("lib/services/email-sync/email-sync-oauth.ts", "utf8"))
  });

  const docRequestTemplate = buildEmailSyncTemplate("document_request", {
    workspaceName: seeded.workspace.name,
    recipientName: "Client",
    securePortalLink: buildSecurePortalLoginLink("https://aria.example.com")
  });
  checks.push({
    name: "Dry-run email payload contains no sensitive fields",
    pass: assertSafeEmailPayload({ ...docRequestTemplate, to: "client@example.com" }).safe
  });
  checks.push({
    name: "Default document request email contains secure portal wording only",
    pass: /secure client portal/i.test(docRequestTemplate.bodyText) && !/passport|grant|dob/i.test(docRequestTemplate.bodyText)
  });

  const appointmentTemplate = buildEmailSyncTemplate("appointment_reminder", {
    workspaceName: seeded.workspace.name,
    recipientName: "Client",
    securePortalLink: buildSecurePortalLoginLink("https://aria.example.com")
  });
  checks.push({
    name: "Default appointment reminder email contains no sensitive matter facts",
    pass: !/passport|grant|dob|health|character|visa/i.test(appointmentTemplate.bodyText)
  });

  const thread = {
    externalThreadId: "gmail-thread-a",
    externalMessageId: "gmail-message-a",
    subjectPreview: "Secure portal document follow-up",
    fromPreview: "client@example.com",
    toPreview: ["agent@example.com"],
    lastMessageAt: new Date().toISOString(),
    messageCount: 2
  };

  const ownLink = await linkMatterEmailThread({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matterA.id,
    user: seeded.agentA,
    thread
  });
  checks.push({
    name: "Manual thread linking requires matter permission",
    pass: ownLink.ok
  });

  const blockedLink = await linkMatterEmailThread({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matterB.id,
    user: seeded.agentA,
    thread: { ...thread, externalThreadId: "gmail-thread-b" }
  });
  checks.push({
    name: "Agent cannot link another agent matter thread without permission",
    pass: !blockedLink.ok
  });

  const invisibleWorkspace = await getMatterEmailWorkspace({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matterB.id,
    user: seeded.agentA
  });
  checks.push({
    name: "Agent cannot see another agent linked email thread unless permitted",
    pass: invisibleWorkspace === null
  });

  const ownWorkspace = await getMatterEmailWorkspace({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matterA.id,
    user: seeded.agentA
  });
  checks.push({
    name: "Platform admin cannot see mailbox content",
    pass: !/matterEmailThread|emailSyncEvent|linked email thread/i.test(
      readFileSync("app/admin/workspaces/[workspaceId]/page.tsx", "utf8") + readFileSync("app/admin/integrations/page.tsx", "utf8")
    )
  });
  checks.push({
    name: "Client portal cannot see internal email threads",
    pass: !/email_sync|MatterEmailThread|MatterEmailMessage/.test(
      readFileSync("app/client/portal/[token]/page.tsx", "utf8") + readFileSync("app/client/book/[token]/page.tsx", "utf8")
    )
  });
  checks.push({
    name: "No message body is imported by default",
    pass: Boolean(ownWorkspace?.linkedThreads.length) && (ownWorkspace?.linkedThreads[0]?.messages.length ?? 0) === 0
  });

  const fallbackSend = await sendMatterClientEmail({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matterA.id,
    user: seeded.agentA,
    template: "document_request",
    requestOrigin: "https://aria.example.com"
  });
  checks.push({
    name: "Disabled fallback manual copy state works",
    pass: fallbackSend.ok && fallbackSend.delivered === false && fallbackSend.fallbackMode === "manual_copy"
  });
  checks.push({
    name: "Raw tokens tokenHash and document URLs are not exposed",
    pass: JSON.stringify(fallbackSend.payload || {}).search(/tokenHash|rawPortalToken|\/documents\/|storageUrl/i) === -1
  });

  const restoreConfigured = setEnv({
    EMAIL_SYNC_PROVIDER: "gmail",
    GMAIL_CLIENT_ID: "demo-gmail-client-id",
    GMAIL_CLIENT_SECRET: "demo-gmail-client-secret",
    GMAIL_REDIRECT_URI: "https://aria.example.com/api/integrations/email-sync/callback"
  });
  await upsertWorkspaceProviderConnection({
    workspaceId: seeded.workspace.id,
    key: "email_sync",
    providerName: "gmail",
    accessToken: "dummy-gmail-access-token",
    refreshToken: "dummy-gmail-refresh-token",
    scopes: ["gmail.send", "gmail.metadata"],
    connectedAccountLabel: "agent-a@example.com",
    lastSuccessfulActionAt: new Date()
  });
  const storedConnection = await getWorkspaceProviderConnection(seeded.workspace.id, "email_sync");
  checks.push({
    name: "OAuth token storage uses encrypted token vault path at rest",
    pass: Boolean(storedConnection?.encryptedAccessToken)
      && storedConnection?.encryptedAccessToken !== "dummy-gmail-access-token"
      && decryptStoredProviderToken(storedConnection?.encryptedAccessToken) === "dummy-gmail-access-token"
  });

  const originalFetch = global.fetch;
  global.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("gmail.googleapis.com")) {
      return new Response(JSON.stringify({ id: "sent-demo-id" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(input as any, init);
  }) as typeof fetch;

  const adapter = await getEmailSyncProviderAdapter(context);
  const mockSend = await adapter.sendEmail({
    ...context,
    payload: {
      to: "client@example.com",
      subject: docRequestTemplate.subject,
      bodyText: docRequestTemplate.bodyText,
      securePortalLink: docRequestTemplate.securePortalLink || null,
      templateKey: docRequestTemplate.templateKey || "document_request"
    }
  });
  global.fetch = originalFetch;
  checks.push({
    name: "Provider-connected mock dry-run send works",
    pass: mockSend.ok
  });

  await auditEvent({
    workspaceId: seeded.workspace.id,
    userId: seeded.agentA.id,
    entityType: "EmailSync",
    entityId: "readiness-redaction",
    action: "email_sync.sync_failed",
    metadata: {
      accessToken: "raw-access-token-should-redact",
      tokenHash: "token-hash-should-redact",
      reason: "https://example.com/private-document?token=secret",
      portalUrl: "https://aria.example.com/client/portal/raw-token-demo"
    }
  });
  const audits = await getAuditRows({ workspaceId: seeded.workspace.id }, 20);
  const auditJson = safeJson(audits);
  checks.push({
    name: "Audit metadata redaction works",
    pass: !/raw-access-token-should-redact|token-hash-should-redact|private-document\?token=secret|raw-token-demo/.test(auditJson)
  });

  await disconnectEmailSyncProvider(context);
  const disconnected = await getWorkspaceProviderConnection(seeded.workspace.id, "email_sync");
  checks.push({
    name: "Disconnect revoke clears connection status safely",
    pass: Boolean(disconnected) && disconnected?.connected === false && !disconnected?.encryptedAccessToken && !disconnected?.encryptedRefreshToken
  });

  restoreConfigured();

  const failed = checks.filter((check) => !check.pass);
  console.log(JSON.stringify({
    pass: failed.length === 0,
    workspace: seeded.workspace.slug,
    checks,
    failed: failed.map((item) => item.name)
  }, null, 2));
  if (failed.length) process.exit(1);
}

main().finally(async () => prisma.$disconnect());
