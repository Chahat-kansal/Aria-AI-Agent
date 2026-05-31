import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { encryptString } from "@/lib/security/encryption";
import { sha256Hex } from "@/lib/security/hash";
import { hashEndpoint, getEndpointLast8, redactPushMetadata } from "@/lib/services/push/push-redaction";
import { validatePushSubscriptionShape } from "@/lib/services/push/push-safety";
import { upsertNotificationPreference } from "@/lib/services/push/push-consent";
import type { PushConsentStatus, PushStatus } from "@/lib/providers/push-provider";

const prismaAny = prisma as any;

export async function registerPushDevice(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  provider: string;
  deviceId: string;
  endpoint: string;
  subscriptionJson: string;
  platform?: string | null;
  userAgent?: string | null;
}) {
  if (!validatePushSubscriptionShape(input.subscriptionJson)) {
    throw new Error("Push subscription payload is invalid.");
  }

  const record = await prismaAny.pushSubscription.upsert({
    where: { workspaceId_deviceId: { workspaceId: input.workspaceId, deviceId: input.deviceId } },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      clientId: input.clientId || null,
      provider: input.provider,
      deviceId: input.deviceId,
      endpointEncrypted: encryptString(input.endpoint),
      endpointHash: hashEndpoint(input.endpoint),
      endpointLast8: getEndpointLast8(input.endpoint),
      subscriptionEncrypted: encryptString(input.subscriptionJson),
      userAgentHash: input.userAgent ? sha256Hex(input.userAgent) : null,
      platform: input.platform || null,
      consentStatus: "OPTED_IN" satisfies PushConsentStatus
    },
    update: {
      userId: input.userId,
      clientId: input.clientId || null,
      provider: input.provider,
      endpointEncrypted: encryptString(input.endpoint),
      endpointHash: hashEndpoint(input.endpoint),
      endpointLast8: getEndpointLast8(input.endpoint),
      subscriptionEncrypted: encryptString(input.subscriptionJson),
      userAgentHash: input.userAgent ? sha256Hex(input.userAgent) : null,
      platform: input.platform || null,
      consentStatus: "OPTED_IN" satisfies PushConsentStatus,
      optOutAt: null,
      lastError: null
    }
  });

  await upsertNotificationPreference({
    workspaceId: input.workspaceId,
    userId: input.userId,
    pushEnabled: true
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "PushSubscription",
    entityId: record.id,
    action: "push.device_registered",
    metadata: { provider: input.provider, endpoint: input.endpoint, platform: input.platform || null }
  });

  await prismaAny.pushEvent.create({
    data: {
      workspaceId: input.workspaceId,
      pushSubscriptionId: record.id,
      userId: input.userId,
      eventType: "push.device_registered",
      status: "DRY_RUN" satisfies PushStatus,
      summary: "Push device registered",
      metadataJson: redactPushMetadata({ provider: input.provider, endpoint: input.endpoint, platform: input.platform || null }) as Prisma.InputJsonObject
    }
  });

  return record;
}

export async function unregisterPushDevice(input: {
  workspaceId: string;
  userId: string;
  deviceId: string;
}) {
  const existing = await prismaAny.pushSubscription.findUnique({
    where: { workspaceId_deviceId: { workspaceId: input.workspaceId, deviceId: input.deviceId } }
  });
  if (!existing || existing.userId !== input.userId) {
    return { ok: false, reason: "Device registration not found." };
  }

  await prismaAny.pushSubscription.delete({ where: { id: existing.id } });
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "PushSubscription",
    entityId: existing.id,
    action: "push.device_unregistered",
    metadata: { endpoint: existing.endpointLast8 || null }
  });
  await prismaAny.pushEvent.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      eventType: "push.device_unregistered",
      status: "DRY_RUN" satisfies PushStatus,
      summary: "Push device unregistered"
    }
  });
  return { ok: true, reason: "Device unregistered." };
}

export async function listPushDevicesForUser(workspaceId: string, userId: string) {
  return prismaAny.pushSubscription.findMany({
    where: { workspaceId, userId },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getPushUsageSummary(workspaceId?: string) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const [sendsToday, registeredDevices] = workspaceId
    ? await Promise.all([
        prismaAny.pushEvent.count({
          where: {
            workspaceId,
            status: "SENT" satisfies PushStatus,
            createdAt: { gte: since }
          }
        }),
        prismaAny.pushSubscription.count({ where: { workspaceId } })
      ])
    : [0, 0];

  return { sendsToday, registeredDevices };
}

export async function createInAppNotification(input: {
  workspaceId: string;
  userId: string;
  clientId?: string | null;
  matterId?: string | null;
  eventType: string;
  title: string;
  bodyPreviewRedacted: string;
  route?: string | null;
}) {
  const notification = await prismaAny.inAppNotification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      clientId: input.clientId || null,
      matterId: input.matterId || null,
      eventType: input.eventType,
      title: input.title,
      bodyPreviewRedacted: input.bodyPreviewRedacted,
      route: input.route || null
    }
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "InAppNotification",
    entityId: notification.id,
    action: "notification.created",
    metadata: { eventType: input.eventType, route: input.route || null }
  });

  return notification;
}

export async function listInAppNotifications(workspaceId: string, userId: string, take = 20) {
  return prismaAny.inAppNotification.findMany({
    where: { workspaceId, userId },
    orderBy: { createdAt: "desc" },
    take
  });
}

export async function getUnreadInAppNotificationCount(workspaceId: string, userId: string) {
  return prismaAny.inAppNotification.count({
    where: { workspaceId, userId, isRead: false }
  });
}

export async function markInAppNotificationRead(input: { workspaceId: string; userId: string; notificationId: string }) {
  const updated = await prismaAny.inAppNotification.updateMany({
    where: { id: input.notificationId, workspaceId: input.workspaceId, userId: input.userId },
    data: { isRead: true, readAt: new Date() }
  });
  if (updated.count) {
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "InAppNotification",
      entityId: input.notificationId,
      action: "notification.read"
    });
  }
}

export async function markAllInAppNotificationsRead(input: { workspaceId: string; userId: string }) {
  await prismaAny.inAppNotification.updateMany({
    where: { workspaceId: input.workspaceId, userId: input.userId, isRead: false },
    data: { isRead: true, readAt: new Date() }
  });
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "InAppNotification",
    entityId: input.userId,
    action: "notification.read_all"
  });
}
