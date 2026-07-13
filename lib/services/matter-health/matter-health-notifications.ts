import { auditMatterAction } from "@/lib/services/audit";
import {
  MATTER_HEALTH_THRESHOLDS,
  canReceiveMatterHealthNotifications
} from "@/lib/services/matter-health/matter-health-policy";
import { redactMatterHealthAuditMetadata } from "@/lib/services/matter-health/matter-health-redaction";
import { sendPush } from "@/lib/services/push/send-push";

type NotifiableUser = {
  id: string;
  workspaceId: string;
  role: any;
  status: any;
  visibilityScope: any;
  permissionsJson: any;
};

export async function sendMatterHealthCriticalBlockerNotification(input: {
  actorUserId: string;
  workspaceId: string;
  matterId: string;
  healthScore: number;
  blockerCount: number;
  recipient: NotifiableUser;
  dryRun?: boolean;
}) {
  if (input.healthScore > MATTER_HEALTH_THRESHOLDS.criticalNotification && input.blockerCount < 1) {
    return { notified: false, reason: "Health score is above the critical notification threshold." };
  }

  if (!canReceiveMatterHealthNotifications(input.recipient)) {
    await auditMatterAction({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      matterId: input.matterId,
      action: "matter_health.notification_blocked",
      metadata: redactMatterHealthAuditMetadata({
        recipientUserId: input.recipient.id,
        score: input.healthScore,
        blockerCount: input.blockerCount,
        reason: "recipient_not_eligible"
      })
    });
    return { notified: false, reason: "Recipient is not eligible for matter health alerts." };
  }

  const result = await sendPush({
    workspaceId: input.workspaceId,
    userId: input.recipient.id,
    matterId: input.matterId,
    title: "Aria alert",
    body: "Aria alert: A matter needs agent review. Open Aria to review.",
    route: `/app/matter-health?matterId=${input.matterId}`,
    dryRun: input.dryRun,
    isAgentAlert: true,
    allowWithoutConsent: true,
    rateLimitKey: `matter-health:${input.workspaceId}:${input.matterId}:${input.recipient.id}`,
    eventType: "matter_health_critical"
  });

  await auditMatterAction({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    matterId: input.matterId,
    action: result.delivered ? "matter_health.notification_sent" : "matter_health.notification_blocked",
    metadata: redactMatterHealthAuditMetadata({
      recipientUserId: input.recipient.id,
      score: input.healthScore,
      blockerCount: input.blockerCount,
      delivered: result.delivered,
      status: result.status,
      reason: result.reason || null
    })
  });

  return {
    notified: result.delivered,
    reason: result.reason || null,
    status: result.status
  };
}
