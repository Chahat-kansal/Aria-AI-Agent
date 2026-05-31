import { prisma } from "@/lib/prisma";
import { getPushProviderEnv, getPushProviderStatus } from "@/lib/providers/push-provider";
import { getPushProviderRouter } from "@/lib/services/push/push-provider-router";
import {
  getNotificationPreference,
  upsertNotificationPreference
} from "@/lib/services/push/push-consent";
import {
  getUnreadInAppNotificationCount,
  listInAppNotifications,
  listPushDevicesForUser
} from "@/lib/services/push/device-subscriptions";
import { getPushTemplatePreview } from "@/lib/services/push/push-templates";

export async function getPushIntegrationView(workspaceId: string, userId: string) {
  const [provider, env, settings, preference, devices, notifications, usage, recentAudit, unreadCount] = await Promise.all([
    Promise.resolve(getPushProviderStatus()),
    Promise.resolve(getPushProviderEnv()),
    prisma.workspaceOperationalSettings.findUnique({ where: { workspaceId } }),
    getNotificationPreference(workspaceId, userId),
    listPushDevicesForUser(workspaceId, userId),
    listInAppNotifications(workspaceId, userId, 12),
    getPushProviderRouter().getUsageSummary(workspaceId),
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
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
      },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    getUnreadInAppNotificationCount(workspaceId, userId)
  ]);

  return {
    provider,
    env,
    settings,
    preference,
    devices,
    notifications,
    usage,
    recentAudit,
    unreadCount,
    dryRunPreview: {
      webPush: getPushTemplatePreview("document_uploaded"),
      fcm: getPushTemplatePreview("appointment_reminder")
    }
  };
}

export async function saveNotificationPreference(input: {
  workspaceId: string;
  userId: string;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  emailFallbackEnabled?: boolean;
  quietHoursEnabled?: boolean;
}) {
  return upsertNotificationPreference(input);
}

export async function runPushConnectionTest() {
  return getPushProviderRouter().testConnection();
}
