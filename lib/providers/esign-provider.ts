import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export type EsignProviderName = "internal_acknowledgement" | "docusign" | "disabled";

export type EsignConnectionContext = {
  workspaceId: string;
  userId: string;
  provider: EsignProviderName;
};

export type EsignAcknowledgementPayload = {
  requestId?: string | null;
  title: string;
  requestType: string;
  safeSummary?: string | null;
  portalPath?: string | null;
  expiresAt?: string | null;
};

export type ExternalEnvelopePayload = {
  subject: string;
  emailBlurb: string;
  signerName: string;
  signerEmail: string;
  documentLabel: string;
  securePortalReminder: string;
  customFields: Array<{ name: string; value: string }>;
};

export type EsignProviderResult = {
  ok: boolean;
  provider: EsignProviderName;
  reason?: string | null;
  externalEnvelopeId?: string | null;
  lastSyncedAt?: string | null;
};

export type EsignProviderAdapter = {
  getProviderStatus: () => ProviderStatus;
  getAuthorizationUrl: (context: EsignConnectionContext) => string | null;
  handleOAuthCallback: (context: EsignConnectionContext & { code: string }) => Promise<EsignProviderResult>;
  disconnect: (context: EsignConnectionContext) => Promise<EsignProviderResult>;
  createAcknowledgementRequest: (context: EsignConnectionContext & { payload: EsignAcknowledgementPayload }) => Promise<EsignProviderResult>;
  createExternalEnvelope: (context: EsignConnectionContext & { payload: ExternalEnvelopePayload }) => Promise<EsignProviderResult>;
  sendRequest: (context: EsignConnectionContext & { payload: EsignAcknowledgementPayload }) => Promise<EsignProviderResult>;
  revokeRequest: (context: EsignConnectionContext & { requestId: string }) => Promise<EsignProviderResult>;
  resendRequest: (context: EsignConnectionContext & { requestId: string }) => Promise<EsignProviderResult>;
  getRequestStatus: (context: EsignConnectionContext & { requestId: string }) => Promise<EsignProviderResult>;
  downloadAcknowledgementRecord: (context: EsignConnectionContext & { requestId: string }) => Promise<EsignProviderResult>;
  dryRunAcknowledgementPayload: (payload: EsignAcknowledgementPayload) => EsignAcknowledgementPayload;
  dryRunExternalEnvelopePayload: (payload: ExternalEnvelopePayload) => ExternalEnvelopePayload;
};

export type EsignProviderEnv = {
  provider: EsignProviderName;
  docusignConfigured: boolean;
  providerConfigured: boolean;
  missingEnv: string[];
};

function getDocuSignEnv() {
  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || "",
    userId: process.env.DOCUSIGN_USER_ID || "",
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || "",
    privateKey: process.env.DOCUSIGN_PRIVATE_KEY || "",
    baseUrl: process.env.DOCUSIGN_BASE_URL || "",
    redirectUri: process.env.DOCUSIGN_REDIRECT_URI || ""
  };
}

export function getEsignProviderName(): EsignProviderName {
  const provider = (process.env.ESIGN_PROVIDER || "internal_acknowledgement").trim().toLowerCase();
  if (provider === "docusign" || provider === "disabled") return provider;
  return "internal_acknowledgement";
}

export function getEsignProviderEnv(): EsignProviderEnv {
  const provider = getEsignProviderName();
  const docusign = getDocuSignEnv();
  const docusignConfigured =
    hasConfiguredValue(docusign.integrationKey) &&
    hasConfiguredValue(docusign.userId) &&
    hasConfiguredValue(docusign.accountId) &&
    hasConfiguredSecret(docusign.privateKey) &&
    hasConfiguredValue(docusign.baseUrl) &&
    hasConfiguredValue(docusign.redirectUri);
  const providerConfigured =
    provider === "internal_acknowledgement" ||
    (provider === "docusign" && docusignConfigured);

  return {
    provider,
    docusignConfigured,
    providerConfigured,
    missingEnv: providerConfigured
      ? []
      : provider === "docusign"
        ? [
            "DOCUSIGN_INTEGRATION_KEY",
            "DOCUSIGN_USER_ID",
            "DOCUSIGN_ACCOUNT_ID",
            "DOCUSIGN_PRIVATE_KEY",
            "DOCUSIGN_BASE_URL",
            "DOCUSIGN_REDIRECT_URI"
          ]
        : ["ESIGN_PROVIDER"]
  };
}

export function getDocuSignConfig() {
  return getDocuSignEnv();
}

export function getEsignProviderStatus(): ProviderStatus {
  const env = getEsignProviderEnv();

  return buildProviderStatus({
    key: "esign",
    label: "Client acknowledgement",
    providerName: env.provider,
    configured: env.providerConfigured,
    state: env.provider === "disabled" ? "disabled" : env.providerConfigured ? "configured" : "not_configured",
    missingEnv: env.missingEnv,
    requiredSetupSteps: env.providerConfigured
      ? []
      : env.provider === "docusign"
        ? [
            "Add DocuSign environment variables before enabling any external envelope workflow.",
            "Complete legal review before using external signature wording with clients."
          ]
        : [
            "Internal client acknowledgement is available now.",
            "Configure an external provider only if the firm needs it."
          ],
    notes: [
      "Internal acknowledgements are confirmations for agent review. They are not represented as legal e-signatures unless an external provider is configured and legally reviewed.",
      "Health, character, relationship, and financial declarations remain agent-review-required after client submission."
    ],
    disabledReason: env.provider === "disabled" ? "Client acknowledgement has been explicitly disabled." : null
  });
}
