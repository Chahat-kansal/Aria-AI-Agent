import { prisma } from "@/lib/prisma";
import { getEsignProviderEnv, getEsignProviderName, getEsignProviderStatus } from "@/lib/providers/esign-provider";
import { getWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { getEsignProviderAdapter, runEsignProviderConnectionTest } from "@/lib/services/esign/esign-provider-router";
import { getRetainerTemplateConfigured } from "@/lib/services/esign/client-acknowledgement";
import { redactEsignPayload } from "@/lib/services/esign/esign-redaction";

export async function getEsignIntegrationView(workspaceId: string, userId: string) {
  const provider = getEsignProviderStatus();
  const env = getEsignProviderEnv();
  const connection = await getWorkspaceProviderConnection(workspaceId, "esign");
  const adapter = getEsignProviderAdapter();
  const recentAudit = await prisma.auditEvent.findMany({
    where: {
      workspaceId,
      action: {
        in: [
          "provider.esign.test_success",
          "provider.esign.test_failed",
          "esign.connection_tested",
          "esign.provider_connected",
          "esign.provider_disconnected",
          "esign.external_envelope_created",
          "esign.external_envelope_failed",
          "acknowledgement.request_created",
          "acknowledgement.request_sent",
          "acknowledgement.request_submitted",
          "acknowledgement.request_revoked",
          "acknowledgement.request_resent"
        ]
      }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const lastRequest = await prisma.clientAcknowledgementRequest.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, createdAt: true, lastErrorSummary: true }
  });
  const dryRunExternalPreview = adapter.dryRunExternalEnvelopePayload({
    subject: "Aria client acknowledgement / confirmation",
    emailBlurb: "Please review the confirmation request in your secure Aria portal.",
    signerName: "Dummy Client",
    signerEmail: "dummy-client@example.com",
    documentLabel: "Review-required acknowledgement pack",
    securePortalReminder: "View details in Aria. No raw document URLs are used.",
    customFields: [
      { name: "workspace", value: "Dummy workspace" },
      { name: "request_type", value: "GENERAL_CONFIRMATION" }
    ]
  });

  return {
    provider,
    env,
    connection,
    recentAudit,
    lastRequest,
    authorizationUrl: adapter.getAuthorizationUrl({ workspaceId, userId, provider: getEsignProviderName() }),
    retainerTemplateConfigured: await getRetainerTemplateConfigured(workspaceId),
    dryRunExternalPreview: redactEsignPayload(dryRunExternalPreview)
  };
}

export { runEsignProviderConnectionTest };
