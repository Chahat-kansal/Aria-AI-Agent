import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { getOrCreateWorkspaceOperationalSettings } from "@/lib/services/workspace-operational-settings";
import type { PushConsentCheckResult, PushConsentStatus } from "@/lib/providers/push-provider";

const prismaAny = prisma as any;

export async function getNotificationPreference(workspaceId: string, userId: string) {
  return prismaAny.notificationPreference.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } }
  });
}

export async function upsertNotificationPreference(input: {
  workspaceId: string;
  userId: string;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  emailFallbackEnabled?: boolean;
  quietHoursEnabled?: boolean;
}) {
  return prismaAny.notificationPreference.upsert({
    where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      pushEnabled: input.pushEnabled ?? false,
      inAppEnabled: input.inAppEnabled ?? true,
      emailFallbackEnabled: input.emailFallbackEnabled ?? true,
      quietHoursEnabled: input.quietHoursEnabled ?? false
    },
    update: {
      ...(typeof input.pushEnabled === "boolean" ? { pushEnabled: input.pushEnabled } : {}),
      ...(typeof input.inAppEnabled === "boolean" ? { inAppEnabled: input.inAppEnabled } : {}),
      ...(typeof input.emailFallbackEnabled === "boolean" ? { emailFallbackEnabled: input.emailFallbackEnabled } : {}),
      ...(typeof input.quietHoursEnabled === "boolean" ? { quietHoursEnabled: input.quietHoursEnabled } : {})
    }
  });
}

export async function recordPushOptOut(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  reason?: string | null;
}) {
  await upsertNotificationPreference({
    workspaceId: input.workspaceId,
    userId: input.userId,
    pushEnabled: false
  });

  await prismaAny.pushSubscription.updateMany({
    where: { workspaceId: input.workspaceId, userId: input.userId, ...(input.clientId ? { clientId: input.clientId } : {}) },
    data: { consentStatus: "OPTED_OUT" satisfies PushConsentStatus, optOutAt: new Date() }
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "PushSubscription",
    entityId: input.clientId || input.userId,
    action: "push.opted_out",
    metadata: { clientId: input.clientId || null, reason: input.reason || "recorded" }
  });
}

export async function checkPushConsent(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  isAgentAlert?: boolean;
}): Promise<PushConsentCheckResult> {
  const [settings, preference, subscriptions] = await Promise.all([
    getOrCreateWorkspaceOperationalSettings(input.workspaceId),
    getNotificationPreference(input.workspaceId, input.userId),
    prismaAny.pushSubscription.findMany({
      where: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        ...(input.clientId ? { clientId: input.clientId } : {})
      },
      take: 5
    })
  ]);

  if (input.isAgentAlert) {
    const allowed = Boolean(settings.pushEnabled && settings.pushAgentAlertsEnabled && preference?.pushEnabled);
    return {
      allowed,
      consentStatus: "INTERNAL_ONLY" satisfies PushConsentStatus,
      reason: allowed ? "agent_alert_allowed" : "push_notifications_not_enabled"
    };
  }

  if (!settings.pushEnabled) {
    return { allowed: false, consentStatus: "UNKNOWN" satisfies PushConsentStatus, reason: "workspace_push_disabled" };
  }

  const optedOut = subscriptions.find((item: any) => item.consentStatus === "OPTED_OUT");
  if (optedOut) {
    return { allowed: false, consentStatus: "OPTED_OUT" satisfies PushConsentStatus, reason: "push_opted_out" };
  }
  if (!preference?.pushEnabled) {
    return { allowed: false, consentStatus: "UNKNOWN" satisfies PushConsentStatus, reason: "push_notifications_not_enabled" };
  }

  const active = subscriptions.find((item: any) => item.consentStatus === "OPTED_IN");
  if (settings.pushClientOptInRequired && !active && input.clientId) {
    return { allowed: false, consentStatus: "UNKNOWN" satisfies PushConsentStatus, reason: "push_opt_in_not_recorded" };
  }
  return {
    allowed: true,
    consentStatus: (active?.consentStatus || "UNKNOWN") as PushConsentStatus,
    reason: active ? "push_opt_in_recorded" : "workspace_policy_allows_send"
  };
}
