import { auditEvent } from "@/lib/services/audit";
import { getAnalyticsProviderStatus } from "@/lib/providers/analytics-provider";
import type { Prisma } from "@prisma/client";

export type ProductEventName =
  | "workspace_created"
  | "client_invited"
  | "matter_created"
  | "document_uploaded"
  | "extraction_completed"
  | "draft_generated"
  | "portal_confirmation_submitted"
  | "appointment_requested"
  | "invoice_created"
  | "pathway_analysis_run";

export async function trackProductEvent(input: {
  workspaceId: string;
  userId?: string;
  event: ProductEventName;
  properties?: Record<string, unknown>;
}) {
  const status = getAnalyticsProviderStatus();
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "Analytics",
    entityId: input.event,
    action: status.configured ? "provider.analytics.test_success" : "analytics.event_recorded",
    metadata: {
      event: input.event,
      provider: status.providerName,
      properties: (input.properties || {}) as Prisma.InputJsonObject
    }
  });
}
