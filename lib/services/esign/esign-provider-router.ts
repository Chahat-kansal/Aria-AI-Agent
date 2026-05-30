import { getEsignProviderEnv, getEsignProviderName, getEsignProviderStatus, type EsignConnectionContext, type EsignProviderAdapter, type EsignProviderResult } from "@/lib/providers/esign-provider";
import { auditEvent } from "@/lib/services/audit";
import { markWorkspaceProviderDisconnected, recordWorkspaceProviderActivity, upsertWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { redactEsignPayload } from "@/lib/services/esign/esign-redaction";

function result(provider: EsignConnectionContext["provider"], ok: boolean, reason?: string | null): EsignProviderResult {
  return { ok, provider, reason: reason ?? null, lastSyncedAt: new Date().toISOString() };
}

function createInternalAdapter(): EsignProviderAdapter {
  return {
    getProviderStatus: getEsignProviderStatus,
    getAuthorizationUrl: () => null,
    handleOAuthCallback: async (context) => result(context.provider, false, "Internal acknowledgement does not use OAuth."),
    disconnect: async (context) => {
      await markWorkspaceProviderDisconnected({
        workspaceId: context.workspaceId,
        key: "esign",
        providerName: "internal_acknowledgement",
        revokeTokens: true
      });
      return result(context.provider, true, "Internal acknowledgement does not maintain an external connection.");
    },
    createAcknowledgementRequest: async (context) => result(context.provider, true, "Internal acknowledgement request prepared."),
    createExternalEnvelope: async (context) => result(context.provider, false, "External envelope is not available for internal acknowledgement."),
    sendRequest: async (context) => result(context.provider, true, "Internal acknowledgement request sent through Aria."),
    revokeRequest: async (context) => result(context.provider, true, `Request ${context.requestId} revoked.`),
    resendRequest: async (context) => result(context.provider, true, `Request ${context.requestId} re-sent.`),
    getRequestStatus: async (context) => result(context.provider, true, `Status read for ${context.requestId}.`),
    downloadAcknowledgementRecord: async (context) => result(context.provider, true, `Record ready for ${context.requestId}.`),
    dryRunAcknowledgementPayload: (payload) => payload,
    dryRunExternalEnvelopePayload: (payload) => payload
  };
}

function createDocuSignAdapter(): EsignProviderAdapter {
  return {
    getProviderStatus: getEsignProviderStatus,
    getAuthorizationUrl: () => null,
    handleOAuthCallback: async (context) => {
      await upsertWorkspaceProviderConnection({
        workspaceId: context.workspaceId,
        key: "esign",
        providerName: "docusign",
        connectedAccountLabel: "DocuSign service user",
        metadataJson: { authMode: "placeholder_callback" },
        lastSuccessfulActionAt: new Date()
      });
      await auditEvent({
        workspaceId: context.workspaceId,
        userId: context.userId,
        entityType: "Esign",
        entityId: "docusign",
        action: "esign.provider_connected",
        metadata: { provider: context.provider }
      });
      return result(context.provider, true, "DocuSign callback placeholder recorded.");
    },
    disconnect: async (context) => {
      await markWorkspaceProviderDisconnected({
        workspaceId: context.workspaceId,
        key: "esign",
        providerName: "docusign",
        revokeTokens: true
      });
      await auditEvent({
        workspaceId: context.workspaceId,
        userId: context.userId,
        entityType: "Esign",
        entityId: "docusign",
        action: "esign.provider_disconnected",
        metadata: { provider: context.provider }
      });
      return result(context.provider, true, "DocuSign connection marked disconnected.");
    },
    createAcknowledgementRequest: async (context) => result(context.provider, true, `Dry-run request prepared for ${context.payload.title}.`),
    createExternalEnvelope: async (context) => {
      await recordWorkspaceProviderActivity({
        workspaceId: context.workspaceId,
        key: "esign",
        providerName: "docusign",
        lastSuccessfulActionAt: new Date(),
        metadataJson: redactEsignPayload({ envelopeSubject: context.payload.subject, documentLabel: context.payload.documentLabel })
      });
      await auditEvent({
        workspaceId: context.workspaceId,
        userId: context.userId,
        entityType: "Esign",
        entityId: "docusign-envelope",
        action: "esign.external_envelope_created",
        metadata: redactEsignPayload({ subject: context.payload.subject, documentLabel: context.payload.documentLabel })
      });
      return {
        ok: true,
        provider: context.provider,
        externalEnvelopeId: null,
        reason: "DocuSign dry-run payload prepared. No live envelope was sent."
      };
    },
    sendRequest: async (context) => result(context.provider, true, `Dry-run send prepared for ${context.payload.title}.`),
    revokeRequest: async (context) => result(context.provider, true, `Dry-run revoke prepared for ${context.requestId}.`),
    resendRequest: async (context) => result(context.provider, true, `Dry-run resend prepared for ${context.requestId}.`),
    getRequestStatus: async (context) => result(context.provider, true, `Dry-run status prepared for ${context.requestId}.`),
    downloadAcknowledgementRecord: async (context) => result(context.provider, true, `Dry-run record download prepared for ${context.requestId}.`),
    dryRunAcknowledgementPayload: (payload) => payload,
    dryRunExternalEnvelopePayload: (payload) => payload
  };
}

function createDisabledAdapter(): EsignProviderAdapter {
  return {
    getProviderStatus: getEsignProviderStatus,
    getAuthorizationUrl: () => null,
    handleOAuthCallback: async () => result("disabled", false, "External e-signature provider not configured."),
    disconnect: async () => result("disabled", true, "No external e-signature provider is connected."),
    createAcknowledgementRequest: async () => result("disabled", false, "Acknowledgement provider disabled."),
    createExternalEnvelope: async () => result("disabled", false, "External e-signature provider not configured."),
    sendRequest: async () => result("disabled", false, "Acknowledgement provider disabled."),
    revokeRequest: async () => result("disabled", false, "Acknowledgement provider disabled."),
    resendRequest: async () => result("disabled", false, "Acknowledgement provider disabled."),
    getRequestStatus: async () => result("disabled", false, "Acknowledgement provider disabled."),
    downloadAcknowledgementRecord: async () => result("disabled", false, "Acknowledgement provider disabled."),
    dryRunAcknowledgementPayload: (payload) => payload,
    dryRunExternalEnvelopePayload: (payload) => payload
  };
}

export function getEsignProviderAdapter(provider = getEsignProviderName()) {
  if (provider === "internal_acknowledgement") return createInternalAdapter();
  if (provider === "docusign") return createDocuSignAdapter();
  return createDisabledAdapter();
}

export async function runEsignProviderConnectionTest(input: { workspaceId: string; userId: string }) {
  const env = getEsignProviderEnv();
  const provider = getEsignProviderName();
  const ok = provider === "internal_acknowledgement" || env.providerConfigured;
  const action = ok ? "provider.esign.test_success" : "provider.esign.test_failed";
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "Provider",
    entityId: "esign",
    action,
    metadata: { provider, reason: ok ? "Provider available." : "External e-signature provider not configured." }
  });
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "Esign",
    entityId: "connection",
    action: "esign.connection_tested",
    metadata: { provider, configured: ok }
  });
  return { ok, provider };
}
