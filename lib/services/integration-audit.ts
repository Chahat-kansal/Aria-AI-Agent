import type { ProviderKey } from "@/lib/providers/types";
import { auditEvent } from "@/lib/services/audit";

type IntegrationAuditAction =
  | "provider_connected"
  | "provider_disconnected"
  | "provider_tested"
  | "sync_started"
  | "sync_completed"
  | "sync_failed"
  | "webhook_received"
  | "webhook_rejected"
  | "token_refreshed"
  | "token_revoked";

function actionName(action: IntegrationAuditAction) {
  return `integration.${action}`;
}

export async function auditIntegrationEvent(input: {
  workspaceId: string;
  userId?: string;
  providerKey: ProviderKey;
  providerName: string;
  action: IntegrationAuditAction;
  metadata?: Record<string, unknown>;
}) {
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "IntegrationProvider",
    entityId: input.providerKey,
    action: actionName(input.action),
    metadata: {
      providerKey: input.providerKey,
      providerName: input.providerName,
      ...(input.metadata ?? {})
    }
  });
}
