import { ClientChaseStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { addMatterTimelineEvent } from "@/lib/services/client-workflows";
import {
  DEADLINE_AGENT_REMINDER,
  DEADLINE_SAFE_REMINDER,
  allowedReminderChannels,
  canSendDeadlineReminder,
  type DeadlineChannel,
  type ScopedDeadlineUser
} from "@/lib/services/deadlines/deadline-policy";
import { redactDeadlineMetadata, redactDeadlinePreview, redactDeadlineReason } from "@/lib/services/deadlines/deadline-redaction";
import { sendEmail } from "@/lib/services/email/send-email";
import { sendPush } from "@/lib/services/push/send-push";
import { checkRateLimit } from "@/lib/security/rate-limit";

const prismaAny = prisma as any;

export type DeadlineReminderPreview = {
  channel: DeadlineChannel;
  subject: string | null;
  body: string;
  route: string | null;
  blockedReason: string | null;
};

export type DeadlineReminderTarget = {
  workspaceId: string;
  matterId: string | null;
  matterReference: string | null;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  assignedToUserId: string | null;
  title: string;
  category: string;
  clientFacing: boolean;
  clientVisible: boolean;
  route: string | null;
};

async function getClientPreference(workspaceId: string, clientId: string) {
  return prismaAny.clientChasingPreference.findUnique({
    where: { workspaceId_clientId: { workspaceId, clientId } }
  });
}

async function recordDeadlineEvent(input: {
  workspaceId: string;
  deadlineId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  status?: "OPEN" | "COMPLETED" | "CANCELLED" | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prismaAny.deadlineEvent.create({
    data: {
      workspaceId: input.workspaceId,
      deadlineId: input.deadlineId || null,
      actorUserId: input.actorUserId || null,
      eventType: input.eventType,
      status: input.status || null,
      summary: redactDeadlinePreview(input.summary),
      metadataJson: redactDeadlineMetadata(input.metadata || {}) as Prisma.InputJsonObject
    }
  });
}

export async function previewDeadlineReminder(input: {
  actor: ScopedDeadlineUser;
  target: DeadlineReminderTarget;
  preferredChannel?: DeadlineChannel | null;
}) {
  if (!canSendDeadlineReminder(input.actor)) {
    throw new Error("DEADLINE_REMINDER_DENIED");
  }

  const availableChannels = allowedReminderChannels({
    clientFacing: input.target.clientFacing,
    clientEmail: input.target.clientEmail,
    portalAvailable: input.target.clientVisible
  });
  const channel = input.preferredChannel && availableChannels.includes(input.preferredChannel)
    ? input.preferredChannel
    : availableChannels[0];

  let blockedReason: string | null = null;
  if (input.target.clientFacing && input.target.clientId) {
    const preference = await getClientPreference(input.target.workspaceId, input.target.clientId);
    if (!preference) {
      blockedReason = "Consent/preferences not recorded.";
    } else if (preference.optedOutNonEssential) {
      blockedReason = "Client opted out of non-essential reminders.";
    } else if (channel === "portal" && !preference.portalEnabled) {
      blockedReason = "Portal reminders are not enabled for this client.";
    } else if (channel === "email" && !preference.emailEnabled) {
      blockedReason = "Email reminders are not enabled for this client.";
    }
  }

  return {
    channel,
    subject: channel === "email" ? "Operational deadline reminder" : null,
    body: input.target.clientFacing ? DEADLINE_SAFE_REMINDER : DEADLINE_AGENT_REMINDER,
    route: input.target.route,
    blockedReason
  } satisfies DeadlineReminderPreview;
}

export async function sendDeadlineReminder(input: {
  actor: ScopedDeadlineUser;
  deadlineId?: string | null;
  target: DeadlineReminderTarget;
  preferredChannel?: DeadlineChannel | null;
}) {
  const preview = await previewDeadlineReminder(input);
  if (preview.blockedReason) {
    await recordDeadlineEvent({
      workspaceId: input.target.workspaceId,
      deadlineId: input.deadlineId,
      actorUserId: input.actor.id,
      eventType: "deadline.reminder_blocked",
      summary: preview.blockedReason,
      metadata: { channel: preview.channel, category: input.target.category }
    });
    await auditEvent({
      workspaceId: input.target.workspaceId,
      userId: input.actor.id,
      entityType: "MatterDeadline",
      entityId: input.deadlineId || input.target.matterId || "derived",
      action: "deadline.reminder_blocked",
      metadata: { channel: preview.channel, reason: preview.blockedReason, category: input.target.category } as Prisma.InputJsonObject
    });
    return { delivered: false, reason: preview.blockedReason, channel: preview.channel };
  }

  const rateKey = `deadline:${input.target.workspaceId}:${input.target.clientId || input.target.assignedToUserId || "shared"}:${input.target.category}:${preview.channel}`;
  const rateLimit = checkRateLimit({ key: rateKey, limit: 1, windowMs: 6 * 60 * 60 * 1000 });
  if (!rateLimit.allowed) {
    const reason = "Deadline reminder is temporarily rate limited.";
    await recordDeadlineEvent({
      workspaceId: input.target.workspaceId,
      deadlineId: input.deadlineId,
      actorUserId: input.actor.id,
      eventType: "deadline.reminder_rate_limited",
      summary: reason,
      metadata: { channel: preview.channel, category: input.target.category }
    });
    await auditEvent({
      workspaceId: input.target.workspaceId,
      userId: input.actor.id,
      entityType: "MatterDeadline",
      entityId: input.deadlineId || input.target.matterId || "derived",
      action: "deadline.reminder_rate_limited",
      metadata: { channel: preview.channel, category: input.target.category } as Prisma.InputJsonObject
    });
    return { delivered: false, reason, channel: preview.channel };
  }

  let delivered = false;
  let reason = "Reminder logged for agent review.";

  if (!input.target.clientFacing) {
    if (input.target.assignedToUserId) {
      const result = await sendPush({
        workspaceId: input.target.workspaceId,
        userId: input.target.assignedToUserId,
        matterId: input.target.matterId || undefined,
        title: "Aria",
        body: DEADLINE_AGENT_REMINDER,
        route: input.target.route || "/app/deadlines",
        isAgentAlert: true,
        eventType: "deadline_attention_required"
      });
      delivered = Boolean(result.delivered || result.fallbackCreated);
      reason = result.reason || reason;
    }
  } else if (preview.channel === "portal" && input.target.matterId) {
    await addMatterTimelineEvent({
      workspaceId: input.target.workspaceId,
      matterId: input.target.matterId,
      actorUserId: input.actor.id,
      eventType: "portal.reminder_posted",
      title: "Reminder from migration team",
      description: DEADLINE_SAFE_REMINDER
    });
    delivered = true;
    reason = "Portal reminder posted.";
  } else if (preview.channel === "email" && input.target.clientEmail) {
    const result = await sendEmail({
      to: input.target.clientEmail,
      template: "deadline_reminder",
      templateInput: {
        recipientName: input.target.clientName || "client",
        workspaceName: "Aria",
        intro: DEADLINE_SAFE_REMINDER,
        secureLink: input.target.route || undefined,
        actionLabel: "Open secure portal",
        footer: "Your migration team will review all deadline actions before use."
      },
      workspaceId: input.target.workspaceId,
      userId: input.actor.id,
      metadata: { category: input.target.category }
    });
    delivered = result.delivered;
    reason = result.reason;
  }

  await recordDeadlineEvent({
    workspaceId: input.target.workspaceId,
    deadlineId: input.deadlineId,
    actorUserId: input.actor.id,
    eventType: delivered ? "deadline.reminder_sent" : "deadline.reminder_failed",
    summary: delivered ? reason : redactDeadlineReason(reason),
    metadata: { channel: preview.channel, category: input.target.category }
  });
  await auditEvent({
    workspaceId: input.target.workspaceId,
    userId: input.actor.id,
    entityType: "MatterDeadline",
    entityId: input.deadlineId || input.target.matterId || "derived",
    action: delivered ? "deadline.reminder_sent" : "deadline.reminder_failed",
    metadata: { channel: preview.channel, category: input.target.category, delivered } as Prisma.InputJsonObject
  });

  if (input.deadlineId) {
    await prismaAny.matterDeadline.update({
      where: { id: input.deadlineId },
      data: {
        reminderLastSentAt: delivered ? new Date() : undefined,
        reminderStatus: delivered ? ClientChaseStatus.SENT : ClientChaseStatus.ERROR
      }
    }).catch(() => null);
  }

  return { delivered, reason, channel: preview.channel };
}
