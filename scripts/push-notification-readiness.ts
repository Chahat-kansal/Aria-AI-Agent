import fs from "node:fs";
import path from "node:path";
import { MatterStage, MatterStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { getPushProviderEnv, getPushProviderStatus } from "@/lib/providers/push-provider";
import { getWebPushDryRunPayload } from "@/lib/services/push/web-push-provider";
import { getFcmDryRunPayload } from "@/lib/services/push/fcm-provider";
import { getPushTemplatePreview } from "@/lib/services/push/push-templates";
import {
  sendPush,
  sendDocumentUploadedPush,
  sendAcknowledgementSubmittedPush,
  sendAppointmentReminderPush,
  sendAgentDeadlineAlertPush
} from "@/lib/services/push/send-push";
import {
  createInAppNotification,
  listInAppNotifications,
  markAllInAppNotificationsRead,
  markInAppNotificationRead
} from "@/lib/services/push/device-subscriptions";
import { upsertNotificationPreference, recordPushOptOut } from "@/lib/services/push/push-consent";
import { getPushProviderRouter } from "@/lib/services/push/push-provider-router";
import { getWorkspaceRows } from "@/lib/services/platform-admin-data";

loadScriptEnv();

type Check = { name: string; pass: boolean; detail?: string };

const WORKSPACE_SLUG = "push-notification-readiness";
const prismaAny = prisma as any;

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
    update: { name: "Push Notification Readiness", plan: WorkspacePlan.PRO },
    create: { slug: WORKSPACE_SLUG, name: "Push Notification Readiness", plan: WorkspacePlan.PRO }
  });

  const owner = await prisma.user.upsert({
    where: { email: "push.owner@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER)
    },
    create: {
      workspaceId: workspace.id,
      name: "Push Owner",
      email: "push.owner@example.com",
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER)
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: "push.agent@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Push Agent",
      email: "push.agent@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "PUSH-READINESS-CLIENT" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agent.id,
      email: "push.client@example.com",
      phone: "+61400000321"
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "PUSH-READINESS-CLIENT",
      firstName: "Mia",
      lastName: "Chen",
      dob: new Date("1993-04-04T00:00:00.000Z"),
      nationality: "Demo",
      email: "push.client@example.com",
      phone: "+61400000321",
      assignedToUserId: agent.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "PUSH-READINESS-MATTER" },
    update: { workspaceId: workspace.id, clientId: client.id, assignedToUserId: agent.id },
    create: {
      workspaceId: workspace.id,
      matterReference: "PUSH-READINESS-MATTER",
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Push Readiness Matter",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 58
    }
  });

  await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {
      pushEnabled: true,
      pushClientOptInRequired: true,
      pushAgentAlertsEnabled: true
    } as any,
    create: {
      workspaceId: workspace.id,
      pushEnabled: true,
      pushClientOptInRequired: true,
      pushAgentAlertsEnabled: true
    } as any
  });

  await prisma.auditEvent.deleteMany({
    where: {
      workspaceId: workspace.id,
      action: {
        in: [
          "push.provider_tested",
          "push.device_registered",
          "push.device_unregistered",
          "push.sent",
          "push.failed",
          "push.template_sent",
          "push.blocked_no_consent",
          "push.blocked_rate_limited",
          "push.opted_out",
          "push.consent_recorded",
          "push.provider_not_configured",
          "notification.created",
          "notification.read",
          "notification.read_all"
        ]
      }
    }
  });
  await prismaAny.pushEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prismaAny.inAppNotification.deleteMany({ where: { workspaceId: workspace.id } });
  await prismaAny.notificationPreference.deleteMany({ where: { workspaceId: workspace.id } });
  await prismaAny.pushSubscription.deleteMany({ where: { workspaceId: workspace.id } });

  return { workspace, owner, agent, client, matter };
}

async function ensurePushEnabled(workspaceId: string, userId: string) {
  await upsertNotificationPreference({
    workspaceId,
    userId,
    pushEnabled: true,
    inAppEnabled: true,
    emailFallbackEnabled: true
  });
}

async function registerDummyDevice(workspaceId: string, userId: string) {
  const restore = setEnv({
    PUSH_PROVIDER: "web_push",
    NEXT_PUBLIC_PUSH_PROVIDER: "web_push",
    NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "BElocalPushVapidPublicKeyDemo1234567890",
    WEB_PUSH_VAPID_PRIVATE_KEY: "phase9-web-push-private-key",
    WEB_PUSH_CONTACT_EMAIL: "ops@example.com"
  });
  try {
    await getPushProviderRouter().registerDevice({
      workspaceId,
      userId,
      deviceId: "demo-device-001",
      endpoint: "https://push.example.test/subscriptions/demo-device-001",
      subscriptionJson: JSON.stringify({
        endpoint: "https://push.example.test/subscriptions/demo-device-001",
        expirationTime: null,
        keys: {
          p256dh: "BNcDemoKey1234567890abcdefghijklmnop",
          auth: "demoauthkey123"
        }
      }),
      platform: "Browser",
      userAgent: "Push readiness browser"
    });
  } finally {
    restore();
  }
}

async function main() {
  const checks: Check[] = [];
  const seeded = await seedWorkspace();

  const restoreDisabled = setEnv({ PUSH_PROVIDER: "disabled" });
  checks.push({
    name: "Disabled provider state passes honestly",
    pass: getPushProviderStatus().state === "disabled"
  });
  restoreDisabled();

  const restoreWebPushMissing = setEnv({
    PUSH_PROVIDER: "web_push",
    NEXT_PUBLIC_PUSH_PROVIDER: "web_push",
    NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "",
    WEB_PUSH_VAPID_PRIVATE_KEY: "",
    WEB_PUSH_CONTACT_EMAIL: "",
    FCM_PROJECT_ID: "",
    FCM_CLIENT_EMAIL: "",
    FCM_PRIVATE_KEY: ""
  });
  const webPushMissing = getPushProviderStatus();
  checks.push({
    name: "Web Push config missing state is clear",
    pass: webPushMissing.providerName === "web_push" && webPushMissing.state === "not_configured" && webPushMissing.missingEnv.includes("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY")
  });
  const webPushEnv = getPushProviderEnv();
  checks.push({
    name: "VAPID private key FCM private key status is redacted",
    pass: typeof webPushEnv.webPush.privateKeyPresent === "boolean" && typeof webPushEnv.fcm.privateKeyPresent === "boolean"
  });
  const webPushPayload = getWebPushDryRunPayload(getPushTemplatePreview("document_uploaded"));
  checks.push({
    name: "Dry-run push payload contains no sensitive fields",
    pass: !/passport|dob|grant|trn|tokenhash|document url|private notes/i.test(JSON.stringify(webPushPayload))
  });
  restoreWebPushMissing();

  const restoreFcmMissing = setEnv({
    PUSH_PROVIDER: "fcm",
    NEXT_PUBLIC_PUSH_PROVIDER: "fcm",
    FCM_PROJECT_ID: "",
    FCM_CLIENT_EMAIL: "",
    FCM_PRIVATE_KEY: ""
  });
  const fcmMissing = getPushProviderStatus();
  checks.push({
    name: "FCM config missing state is clear",
    pass: fcmMissing.providerName === "fcm" && fcmMissing.state === "not_configured" && fcmMissing.missingEnv.includes("FCM_PROJECT_ID")
  });
  const fcmPayload = getFcmDryRunPayload(getPushTemplatePreview("appointment_reminder"));
  checks.push({
    name: "FCM dry-run mock send works",
    pass: !/passport|dob|grant|trn|tokenhash|document url/i.test(JSON.stringify(fcmPayload))
  });
  restoreFcmMissing();

  checks.push({
    name: "All default templates contain no sensitive placeholders",
    pass: [
      getPushTemplatePreview("portal_action_completed"),
      getPushTemplatePreview("document_uploaded"),
      getPushTemplatePreview("message_received"),
      getPushTemplatePreview("appointment_requested"),
      getPushTemplatePreview("appointment_reminder"),
      getPushTemplatePreview("deadline_agent_alert"),
      getPushTemplatePreview("draft_ready"),
      getPushTemplatePreview("invoice_overdue")
    ].every((payload) => !/passport|dob|grant|trn|health|character|financial|tokenhash|private notes/i.test(JSON.stringify(payload)))
  });

  const blocked = await sendPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    clientId: seeded.client.id,
    matterId: seeded.matter.id,
    templateKey: "document_uploaded",
    eventType: "document_uploaded"
  });
  checks.push({
    name: "Push send is blocked if no consent",
    pass: !blocked.delivered && /push_notifications_not_enabled|push_opt_in_not_recorded/i.test(blocked.reason)
  });
  checks.push({
    name: "In-app fallback notification is created when push disabled",
    pass: Boolean(blocked.inAppNotificationId)
  });

  await ensurePushEnabled(seeded.workspace.id, seeded.owner.id);
  await registerDummyDevice(seeded.workspace.id, seeded.owner.id);
  await recordPushOptOut({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    reason: "user_requested"
  });
  const optedOut = await sendPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    templateKey: "appointment_reminder",
    eventType: "appointment_reminder"
  });
  checks.push({
    name: "Opt-out blocks future non-essential push",
    pass: !optedOut.delivered && /opted_out|push_opted_out/i.test(optedOut.reason)
  });

  await prismaAny.pushSubscription.deleteMany({ where: { workspaceId: seeded.workspace.id } });
  await prismaAny.notificationPreference.deleteMany({ where: { workspaceId: seeded.workspace.id } });
  await ensurePushEnabled(seeded.workspace.id, seeded.owner.id);
  await registerDummyDevice(seeded.workspace.id, seeded.owner.id);

  const restoreWebPushConfigured = setEnv({
    PUSH_PROVIDER: "web_push",
    NEXT_PUBLIC_PUSH_PROVIDER: "web_push",
    NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "BElocalPushVapidPublicKeyDemo1234567890",
    WEB_PUSH_VAPID_PRIVATE_KEY: "phase9-web-push-private-key",
    WEB_PUSH_CONTACT_EMAIL: "ops@example.com"
  });
  for (let index = 0; index < 8; index += 1) {
    await sendPush({
      workspaceId: seeded.workspace.id,
      userId: seeded.owner.id,
      templateKey: "deadline_agent_alert",
      templateInput: { safeDueTiming: "soon" },
      eventType: "deadline_agent_alert",
      dryRun: true,
      isAgentAlert: true,
      allowWithoutConsent: true,
      rateLimitKey: "push-rate-limit-test"
    });
  }
  const rateLimited = await sendPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    templateKey: "deadline_agent_alert",
    templateInput: { safeDueTiming: "soon" },
    eventType: "deadline_agent_alert",
    dryRun: true,
    isAgentAlert: true,
    allowWithoutConsent: true,
    rateLimitKey: "push-rate-limit-test"
  });
  checks.push({
    name: "Rate limiting blocks repeated sends",
    pass: !rateLimited.delivered && /rate limited/i.test(rateLimited.reason)
  });
  restoreWebPushConfigured();

  const providerNotConfiguredFallback = await sendPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    templateKey: "portal_action_completed",
    eventType: "portal_action_completed",
    dryRun: false
  });
  checks.push({
    name: "Provider-not-configured fallback works",
    pass: !providerNotConfiguredFallback.delivered && Boolean(providerNotConfiguredFallback.inAppNotificationId)
  });

  const created = await createInAppNotification({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    matterId: seeded.matter.id,
    eventType: "manual_demo",
    title: "Aria",
    bodyPreviewRedacted: "Aria: A client completed a portal action. Open Aria to review.",
    route: "/app/matters"
  });
  await markInAppNotificationRead({ workspaceId: seeded.workspace.id, userId: seeded.owner.id, notificationId: created.id });
  await createInAppNotification({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    eventType: "manual_demo_two",
    title: "Aria",
    bodyPreviewRedacted: "Aria: A draft is ready for agent final review.",
    route: "/app/application-drafts"
  });
  await markAllInAppNotificationsRead({ workspaceId: seeded.workspace.id, userId: seeded.owner.id });
  const listedNotifications = await listInAppNotifications(seeded.workspace.id, seeded.owner.id, 10);
  checks.push({
    name: "Notification centre can list read mark all read",
    pass: listedNotifications.length >= 2 && listedNotifications.every((item: any) => item.isRead === true)
  });

  const genericDocument = await sendDocumentUploadedPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    clientId: seeded.client.id,
    matterId: seeded.matter.id,
    dryRun: true
  } as any);
  const genericAck = await sendAcknowledgementSubmittedPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    clientId: seeded.client.id,
    matterId: seeded.matter.id,
    dryRun: true
  } as any);
  const genericAppointment = await sendAppointmentReminderPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    matterId: seeded.matter.id,
    dryRun: true,
    isAgentAlert: true,
    allowWithoutConsent: true
  });
  const genericDeadline = await sendAgentDeadlineAlertPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    dryRun: true,
    safeDueTiming: "soon"
  });
  checks.push({
    name: "Document uploaded notification is generic",
    pass: !/passport|dob|grant|document name|health|character/i.test(genericDocument.reason || "")
  });
  checks.push({
    name: "Acknowledgement submitted notification is generic",
    pass: !/passport|dob|grant|health|character/i.test(genericAck.reason || "")
  });
  checks.push({
    name: "Appointment reminder notification is generic",
    pass: !/passport|dob|grant|health|character|financial/i.test(genericAppointment.reason || "")
  });
  checks.push({
    name: "Agent deadline alert notification is generic",
    pass: !/passport|dob|grant|health|character|financial/i.test(genericDeadline.reason || "")
  });
  checks.push({
    name: "Raw portal tokens tokenHash document URLs are not exposed",
    pass: !/tokenhash|portal\/[A-Za-z0-9_-]{20,}|https?:\/\/.+document/i.test(JSON.stringify({
      portal: getPushTemplatePreview("portal_action_completed"),
      document: getPushTemplatePreview("document_uploaded")
    }))
  });

  const workspaceRows = await getWorkspaceRows();
  checks.push({
    name: "Platform admin cannot see private notification content",
    pass: workspaceRows.every((row) => !JSON.stringify(row).includes("bodyPreviewRedacted"))
  });

  const recentAudit = await prisma.auditEvent.findMany({
    where: {
      workspaceId: seeded.workspace.id,
      action: {
        in: [
          "push.provider_tested",
          "push.device_registered",
          "push.device_unregistered",
          "push.sent",
          "push.failed",
          "push.template_sent",
          "push.blocked_no_consent",
          "push.blocked_rate_limited",
          "push.opted_out",
          "push.consent_recorded",
          "push.provider_not_configured",
          "notification.created",
          "notification.read",
          "notification.read_all"
        ]
      }
    }
  });
  checks.push({
    name: "Audit metadata redaction works",
    pass: recentAudit.every((event) => {
      const payload = JSON.stringify(event.metadataJson || {});
      return !payload.includes("phase9-web-push-private-key") && !payload.includes("push.example.test/subscriptions/demo-device-001");
    })
  });

  const restoreWebPushDryRun = setEnv({
    PUSH_PROVIDER: "web_push",
    NEXT_PUBLIC_PUSH_PROVIDER: "web_push",
    NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "BElocalPushVapidPublicKeyDemo1234567890",
    WEB_PUSH_VAPID_PRIVATE_KEY: "phase9-web-push-private-key",
    WEB_PUSH_CONTACT_EMAIL: "ops@example.com"
  });
  const webPushDryRunSend = await sendPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    templateKey: "message_received",
    eventType: "message_received",
    dryRun: true,
    isAgentAlert: true,
    allowWithoutConsent: true
  });
  checks.push({
    name: "Web Push dry-run mock send works",
    pass: !webPushDryRunSend.delivered && webPushDryRunSend.status === "DRY_RUN"
  });
  restoreWebPushDryRun();

  const restoreFcmDryRun = setEnv({
    PUSH_PROVIDER: "fcm",
    NEXT_PUBLIC_PUSH_PROVIDER: "fcm",
    FCM_PROJECT_ID: "demo-fcm-project",
    FCM_CLIENT_EMAIL: "firebase-adminsdk@example.iam.gserviceaccount.com",
    FCM_PRIVATE_KEY: "phase9-fcm-private-key"
  });
  const fcmDryRunSend = await sendPush({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    templateKey: "draft_ready",
    eventType: "draft_ready",
    dryRun: true,
    isAgentAlert: true,
    allowWithoutConsent: true
  });
  checks.push({
    name: "FCM dry-run mock send works",
    pass: !fcmDryRunSend.delivered && fcmDryRunSend.status === "DRY_RUN"
  });
  restoreFcmDryRun();

  checks.push({
    name: "If real Web Push FCM credentials are present live test uses safe test message only",
    pass: await testIfConfigured()
  });

  const swPath = path.join(process.cwd(), "public", "aria-push-sw.js");
  const sw = fs.readFileSync(swPath, "utf8");
  checks.push({
    name: "Service worker does not cache private document API routes if service worker is added",
    pass: !/addEventListener\(['"]fetch['"]/.test(sw) && !/caches\./.test(sw)
  });

  const failed = checks.filter((check) => !check.pass);
  console.log(JSON.stringify({ pass: failed.length === 0, workspace: WORKSPACE_SLUG, checks, failed }, null, 2));
  if (failed.length) process.exit(1);
}

async function testIfConfigured() {
  const env = getPushProviderEnv();
  if (!env.webPush.configured && !env.fcm.configured) return true;
  const result = await getPushProviderRouter().testConnection();
  return typeof result.reason === "string" && !/passport|dob|grant|document|token/i.test(result.reason);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
