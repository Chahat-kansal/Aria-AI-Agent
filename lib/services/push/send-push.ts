import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { getPushProviderRouter } from "@/lib/services/push/push-provider-router";
import { checkPushRateLimit } from "@/lib/services/push/push-rate-limit";
import { buildPushTemplate, type PushTemplateInput, type PushTemplateKey } from "@/lib/services/push/push-templates";
import { createInAppNotification, listPushDevicesForUser } from "@/lib/services/push/device-subscriptions";
import { redactPushErrorSummary, redactPushMetadata, redactPushPreview } from "@/lib/services/push/push-redaction";
import { assertSafePushRoute, assertSafePushText } from "@/lib/services/push/push-safety";
import type { PushStatus } from "@/lib/providers/push-provider";

const prismaAny = prisma as any;

export type SendPushInput = {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  matterId?: string | null;
  title?: string;
  body?: string;
  route?: string | null;
  dryRun?: boolean;
  isAgentAlert?: boolean;
  rateLimitKey?: string;
  allowWithoutConsent?: boolean;
  templateKey?: PushTemplateKey;
  templateInput?: PushTemplateInput;
  eventType?: string;
};

async function recordPushEvent(input: {
  workspaceId: string;
  userId?: string | null;
  pushSubscriptionId?: string | null;
  inAppNotificationId?: string | null;
  eventType: string;
  status: PushStatus;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prismaAny.pushEvent.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId || null,
      pushSubscriptionId: input.pushSubscriptionId || null,
      inAppNotificationId: input.inAppNotificationId || null,
      eventType: input.eventType,
      status: input.status,
      summary: input.summary || null,
      metadataJson: redactPushMetadata(input.metadata || {}) as Prisma.InputJsonObject
    }
  });
}

export async function sendPush(input: SendPushInput) {
  const router = getPushProviderRouter();
  const built = input.templateKey
    ? buildPushTemplate(input.templateKey, input.templateInput || {})
    : {
        title: assertSafePushText(input.title || "Aria"),
        body: assertSafePushText(input.body || "Open Aria to review."),
        route: assertSafePushRoute(input.route || null)
      };

  const consent = await router.checkConsent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    clientId: input.clientId,
    isAgentAlert: input.isAgentAlert
  });
  const consentAllowed = input.allowWithoutConsent || input.isAgentAlert || consent.allowed;

  const inApp = await createInAppNotification({
    workspaceId: input.workspaceId,
    userId: input.userId,
    clientId: input.clientId || null,
    matterId: input.matterId || null,
    eventType: input.eventType || input.templateKey || "notification.generic",
    title: built.title,
    bodyPreviewRedacted: redactPushPreview(built.body),
    route: built.route
  });

  if (!consentAllowed) {
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "PushSubscription",
      entityId: inApp.id,
      action: "push.blocked_no_consent",
      metadata: { clientId: input.clientId || null, reason: consent.reason }
    });
    await recordPushEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      inAppNotificationId: inApp.id,
      eventType: "push.blocked_no_consent",
      status: consent.reason === "push_opted_out" ? "OPTED_OUT" : "BLOCKED_NO_CONSENT",
      summary: consent.reason
    });
    return {
      delivered: false,
      fallbackCreated: true,
      reason: consent.reason,
      status: consent.reason === "push_opted_out" ? "OPTED_OUT" : "BLOCKED_NO_CONSENT",
      inAppNotificationId: inApp.id
    };
  }

  const rateKey = input.rateLimitKey || `push:${input.workspaceId}:${input.userId}:${input.templateKey || input.eventType || "generic"}`;
  const rateLimit = checkPushRateLimit({ key: rateKey });
  if (!rateLimit.allowed) {
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "PushSubscription",
      entityId: inApp.id,
      action: "push.blocked_rate_limited",
      metadata: { key: rateKey }
    });
    await recordPushEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      inAppNotificationId: inApp.id,
      eventType: "push.blocked_rate_limited",
      status: "BLOCKED_RATE_LIMITED",
      summary: "rate_limited"
    });
    return {
      delivered: false,
      fallbackCreated: true,
      reason: "Push sending is temporarily rate limited.",
      status: "BLOCKED_RATE_LIMITED",
      inAppNotificationId: inApp.id
    };
  }

  const devices = await listPushDevicesForUser(input.workspaceId, input.userId);
  const activeDevices = devices.filter((device: any) => device.consentStatus !== "OPTED_OUT");
  if (!activeDevices.length) {
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "PushSubscription",
      entityId: inApp.id,
      action: "push.provider_not_configured",
      metadata: { reason: "no_registered_devices" }
    });
    await recordPushEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      inAppNotificationId: inApp.id,
      eventType: "push.provider_not_configured",
      status: "IN_APP_ONLY",
      summary: "no_registered_devices"
    });
    return {
      delivered: false,
      fallbackCreated: true,
      reason: "Push notifications not enabled on a device. In-app fallback created.",
      status: "IN_APP_ONLY",
      inAppNotificationId: inApp.id
    };
  }

  const result = await router.sendPush({
    workspaceId: input.workspaceId,
    userId: input.userId,
    title: built.title,
    body: built.body,
    route: built.route,
    dryRun: input.dryRun,
    tag: input.templateKey || input.eventType || "aria-notification",
    deviceIds: activeDevices.map((device: any) => device.deviceId)
  });

  await prismaAny.pushSubscription.updateMany({
    where: { id: { in: activeDevices.map((device: any) => device.id) } },
    data: {
      ...(result.ok ? { lastSentAt: new Date() } : { lastFailureAt: new Date() }),
      lastError: result.ok ? null : redactPushErrorSummary(result.reason)
    }
  });

  const auditAction = result.ok
    ? input.templateKey ? "push.template_sent" : "push.sent"
    : result.status === "NOT_CONFIGURED"
      ? "push.provider_not_configured"
      : "push.failed";

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "PushSubscription",
    entityId: inApp.id,
    action: auditAction,
    metadata: {
      provider: result.provider,
      status: result.status,
      route: built.route,
      reason: redactPushErrorSummary(result.reason)
    }
  });
  await recordPushEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    inAppNotificationId: inApp.id,
    eventType: auditAction,
    status: result.status,
    summary: result.reason,
    metadata: { provider: result.provider, route: built.route }
  });

  return {
    delivered: result.ok,
    fallbackCreated: true,
    reason: result.reason,
    status: result.status,
    inAppNotificationId: inApp.id
  };
}

export async function sendTemplatePush(input: Omit<SendPushInput, "title" | "body" | "route"> & {
  templateKey: PushTemplateKey;
  templateInput?: PushTemplateInput;
}) {
  return sendPush(input);
}

export async function sendDocumentUploadedPush(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  matterId?: string | null;
}) {
  return sendTemplatePush({ ...input, templateKey: "document_uploaded", eventType: "document_uploaded" });
}

export async function sendAcknowledgementSubmittedPush(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  matterId?: string | null;
}) {
  return sendTemplatePush({ ...input, templateKey: "portal_action_completed", eventType: "acknowledgement_submitted" });
}

export async function sendPortalMessagePush(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  matterId?: string | null;
}) {
  return sendTemplatePush({ ...input, templateKey: "message_received", eventType: "portal_message_received" });
}

export async function sendAppointmentRequestedPush(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  matterId?: string | null;
}) {
  return sendTemplatePush({ ...input, templateKey: "appointment_requested", eventType: "appointment_requested" });
}

export async function sendAppointmentReminderPush(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  matterId?: string | null;
  dryRun?: boolean;
  isAgentAlert?: boolean;
  allowWithoutConsent?: boolean;
}) {
  return sendTemplatePush({ ...input, templateKey: "appointment_reminder", eventType: "appointment_reminder" });
}

export async function sendDraftReadyPush(input: {
  workspaceId: string;
  userId: string;
  matterId?: string | null;
}) {
  return sendTemplatePush({ ...input, templateKey: "draft_ready", eventType: "draft_ready" });
}

export async function sendInvoiceOverduePush(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  matterId?: string | null;
}) {
  return sendTemplatePush({ ...input, templateKey: "invoice_overdue", eventType: "invoice_overdue" });
}

export async function sendProviderFailurePush(input: {
  workspaceId: string;
  userId: string;
}) {
  return sendTemplatePush({ ...input, templateKey: "integration_failure", eventType: "provider_failure", isAgentAlert: true, allowWithoutConsent: true });
}

export async function sendAgentDeadlineAlertPush(input: {
  workspaceId: string;
  userId: string;
  safeDueTiming?: string | null;
  dryRun?: boolean;
  isAgentAlert?: boolean;
  allowWithoutConsent?: boolean;
}) {
  return sendTemplatePush({
    ...input,
    templateKey: "deadline_agent_alert",
    templateInput: { safeDueTiming: input.safeDueTiming || "soon" },
    eventType: "deadline_agent_alert",
    isAgentAlert: input.isAgentAlert ?? true,
    allowWithoutConsent: input.allowWithoutConsent ?? true
  });
}
