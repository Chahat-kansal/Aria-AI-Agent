import { getAccountingProviderStatus } from "@/lib/providers/accounting-provider";
import { prisma } from "@/lib/prisma";
import { getAiProviderStatus } from "@/lib/providers/ai-provider";
import { getAnalyticsProviderStatus } from "@/lib/providers/analytics-provider";
import { getCalendarProviderStatus } from "@/lib/providers/calendar-provider";
import { getCloudDriveProviderStatus } from "@/lib/providers/cloud-drive-provider";
import { getEmailProviderStatus } from "@/lib/providers/email-provider";
import { getEmailSyncProviderStatus } from "@/lib/providers/email-sync-provider";
import { getErrorMonitoringProviderStatus } from "@/lib/providers/error-monitoring-provider";
import { getEsignProviderStatus } from "@/lib/providers/esign-provider";
import { getMobileProviderStatus } from "@/lib/providers/mobile-provider";
import { getOfflineSyncProviderStatus } from "@/lib/providers/offline-sync-provider";
import { getOcrProviderStatus } from "@/lib/providers/ocr-provider";
import { getPaymentProviderStatus } from "@/lib/providers/payment-provider";
import { getPushProviderStatus } from "@/lib/providers/push-provider";
import { getSmsProviderStatus } from "@/lib/providers/sms-provider";
import { getStorageProviderStatus } from "@/lib/providers/storage-provider";
import type { ProviderStatus } from "@/lib/providers/types";
import { redactErrorSummary } from "@/lib/providers/shared";
import { getWorkspaceProviderConnections } from "@/lib/services/oauth-token-vault";

const actionsByProvider: Record<ProviderStatus["key"], { success: string[]; error: string[] }> = {
  email: { success: ["provider.email.test_success"], error: ["provider.email.test_failed"] },
  sms: { success: ["provider.sms.test_success"], error: ["provider.sms.test_failed"] },
  ocr: { success: ["provider.ocr.test_success"], error: ["provider.ocr.test_failed"] },
  ai: { success: ["provider.ai.test_success"], error: ["provider.ai.test_failed"] },
  storage: { success: ["provider.storage.test_success"], error: ["provider.storage.test_failed"] },
  payments: { success: ["provider.payments.test_success"], error: ["provider.payments.test_failed"] },
  esign: { success: ["provider.esign.test_success"], error: ["provider.esign.test_failed"] },
  monitoring: { success: ["provider.monitoring.test_success"], error: ["provider.monitoring.test_failed"] },
  analytics: { success: ["provider.analytics.test_success"], error: ["provider.analytics.test_failed"] },
  accounting: { success: ["integration.provider_tested", "integration.sync_completed"], error: ["integration.sync_failed", "integration.webhook_rejected"] },
  calendar: { success: ["integration.provider_tested", "integration.sync_completed"], error: ["integration.sync_failed", "integration.webhook_rejected"] },
  email_sync: { success: ["integration.provider_tested", "integration.sync_completed"], error: ["integration.sync_failed", "integration.webhook_rejected"] },
  cloud_drive: { success: ["integration.provider_tested", "integration.sync_completed"], error: ["integration.sync_failed", "integration.webhook_rejected"] },
  push: { success: ["integration.provider_tested"], error: ["integration.sync_failed", "integration.webhook_rejected"] },
  mobile: { success: [], error: [] },
  offline_sync: { success: [], error: [] }
};

function baseProviderStatuses() {
  return [
    getAccountingProviderStatus(),
    getCalendarProviderStatus(),
    getEmailProviderStatus(),
    getEmailSyncProviderStatus(),
    getSmsProviderStatus(),
    getOcrProviderStatus(),
    getAiProviderStatus(),
    getStorageProviderStatus(),
    getPaymentProviderStatus(),
    getEsignProviderStatus(),
    getErrorMonitoringProviderStatus(),
    getAnalyticsProviderStatus(),
    getCloudDriveProviderStatus(),
    getPushProviderStatus(),
    getMobileProviderStatus(),
    getOfflineSyncProviderStatus()
  ] satisfies ProviderStatus[];
}

export async function getProviderStatuses(workspaceId?: string) {
  const providers = baseProviderStatuses();

  if (!workspaceId) return providers;

  const [events, connections] = await Promise.all([
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        action: {
          in: Object.values(actionsByProvider).flatMap((item) => [...item.success, ...item.error])
        }
      },
      orderBy: { createdAt: "desc" },
      take: 150
    }),
    getWorkspaceProviderConnections(workspaceId)
  ]);

  return providers.map((provider) => {
    const actionMap = actionsByProvider[provider.key];
    const connection = connections[provider.key];
    const lastSuccess = events.find((event) => actionMap.success.includes(event.action));
    const lastError = events.find((event) => actionMap.error.includes(event.action));
    const connected = connection?.connected ?? provider.connected;
    const connectionState = connection?.connectionState ?? provider.connectionState;
    return {
      ...provider,
      connected,
      connectionState,
      connectedAccountLabel: connection?.connectedAccountLabel ?? provider.connectedAccountLabel ?? null,
      lastSuccessfulTestAt: lastSuccess?.createdAt.toISOString() ?? null,
      lastSuccessfulActionAt: connection?.lastSuccessfulActionAt ?? lastSuccess?.createdAt.toISOString() ?? null,
      lastSyncAt: connection?.lastSyncAt ?? null,
      lastErrorSummary: redactErrorSummary(
        connection?.lastErrorSummary
        || (typeof lastError?.metadataJson === "object" && lastError?.metadataJson && "reason" in (lastError.metadataJson as Record<string, unknown>)
          ? String((lastError.metadataJson as Record<string, unknown>).reason || "")
          : null)
      ),
      state: provider.state === "disabled"
        ? "disabled"
        : provider.configured
          ? connected ? "configured" : "not_configured"
          : provider.state
    };
  });
}

export async function getProviderStatusMap(workspaceId?: string) {
  const statuses = await getProviderStatuses(workspaceId);
  return Object.fromEntries(statuses.map((item) => [item.key, item])) as Record<ProviderStatus["key"], ProviderStatus>;
}
