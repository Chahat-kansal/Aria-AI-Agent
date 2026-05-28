import { prisma } from "@/lib/prisma";
import { getAiProviderStatus } from "@/lib/providers/ai-provider";
import { getAnalyticsProviderStatus } from "@/lib/providers/analytics-provider";
import { getEmailProviderStatus } from "@/lib/providers/email-provider";
import { getErrorMonitoringProviderStatus } from "@/lib/providers/error-monitoring-provider";
import { getEsignProviderStatus } from "@/lib/providers/esign-provider";
import { getOcrProviderStatus } from "@/lib/providers/ocr-provider";
import { getPaymentProviderStatus } from "@/lib/providers/payment-provider";
import { getSmsProviderStatus } from "@/lib/providers/sms-provider";
import { getStorageProviderStatus } from "@/lib/providers/storage-provider";
import type { ProviderStatus } from "@/lib/providers/types";
import { redactErrorSummary } from "@/lib/providers/shared";

const actionsByProvider: Record<ProviderStatus["key"], { success: string[]; error: string[] }> = {
  email: { success: ["provider.email.test_success"], error: ["provider.email.test_failed"] },
  sms: { success: ["provider.sms.test_success"], error: ["provider.sms.test_failed"] },
  ocr: { success: ["provider.ocr.test_success"], error: ["provider.ocr.test_failed"] },
  ai: { success: ["provider.ai.test_success"], error: ["provider.ai.test_failed"] },
  storage: { success: ["provider.storage.test_success"], error: ["provider.storage.test_failed"] },
  payments: { success: ["provider.payments.test_success"], error: ["provider.payments.test_failed"] },
  esign: { success: ["provider.esign.test_success"], error: ["provider.esign.test_failed"] },
  monitoring: { success: ["provider.monitoring.test_success"], error: ["provider.monitoring.test_failed"] },
  analytics: { success: ["provider.analytics.test_success"], error: ["provider.analytics.test_failed"] }
};

function baseProviderStatuses() {
  return [
    getEmailProviderStatus(),
    getSmsProviderStatus(),
    getOcrProviderStatus(),
    getAiProviderStatus(),
    getStorageProviderStatus(),
    getPaymentProviderStatus(),
    getEsignProviderStatus(),
    getErrorMonitoringProviderStatus(),
    getAnalyticsProviderStatus()
  ] satisfies ProviderStatus[];
}

export async function getProviderStatuses(workspaceId?: string) {
  const providers = baseProviderStatuses();

  if (!workspaceId) return providers;

  const events = await prisma.auditEvent.findMany({
    where: {
      workspaceId,
      action: {
        in: Object.values(actionsByProvider).flatMap((item) => [...item.success, ...item.error])
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return providers.map((provider) => {
    const actionMap = actionsByProvider[provider.key];
    const lastSuccess = events.find((event) => actionMap.success.includes(event.action));
    const lastError = events.find((event) => actionMap.error.includes(event.action));
    return {
      ...provider,
      lastSuccessfulTestAt: lastSuccess?.createdAt.toISOString() ?? null,
      lastErrorSummary: redactErrorSummary(
        typeof lastError?.metadataJson === "object" && lastError?.metadataJson && "reason" in (lastError.metadataJson as Record<string, unknown>)
          ? String((lastError.metadataJson as Record<string, unknown>).reason || "")
          : null
      )
    };
  });
}

export async function getProviderStatusMap(workspaceId?: string) {
  const statuses = await getProviderStatuses(workspaceId);
  return Object.fromEntries(statuses.map((item) => [item.key, item])) as Record<ProviderStatus["key"], ProviderStatus>;
}
