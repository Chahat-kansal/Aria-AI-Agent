import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export type EmailSyncProviderName = "gmail" | "microsoft" | "disabled";

export type EmailSyncConnectionContext = {
  workspaceId: string;
  userId: string;
  provider: EmailSyncProviderName;
};

export type EmailSyncOAuthCallbackInput = EmailSyncConnectionContext & {
  code: string;
};

export type EmailThreadMetadata = {
  externalThreadId: string;
  externalMessageId?: string | null;
  subjectPreview: string;
  fromPreview: string;
  toPreview: string[];
  lastMessageAt: string | null;
  messageCount: number;
  hasImportedBody?: boolean;
};

export type EmailMessageMetadata = {
  externalMessageId: string;
  direction: "inbound" | "outbound";
  senderLabel: string;
  recipientLabels: string[];
  sentAt: string | null;
  subjectPreview: string;
  bodyPreview?: string | null;
  bodyImported?: boolean;
};

export type EmailSyncSendPayload = {
  to: string;
  subject: string;
  bodyText: string;
  securePortalLink?: string | null;
  templateKey?: string | null;
  sensitiveContentWarning?: boolean;
};

export type EmailThreadImportPreview = {
  externalThreadId: string;
  subjectPreview: string;
  messages: EmailMessageMetadata[];
  importWarning: string;
};

export type EmailSyncProviderResult = {
  ok: boolean;
  provider: EmailSyncProviderName;
  reason?: string | null;
  externalThreadId?: string | null;
  externalMessageId?: string | null;
  lastSyncedAt?: string | null;
};

export type EmailSyncProviderAdapter = {
  getProviderStatus: () => ProviderStatus;
  getAuthorizationUrl: (context: EmailSyncConnectionContext) => string | null;
  handleOAuthCallback: (input: EmailSyncOAuthCallbackInput) => Promise<EmailSyncProviderResult>;
  refreshToken: (context: EmailSyncConnectionContext) => Promise<EmailSyncProviderResult>;
  disconnect: (context: EmailSyncConnectionContext) => Promise<EmailSyncProviderResult>;
  sendEmail: (context: EmailSyncConnectionContext & { payload: EmailSyncSendPayload }) => Promise<EmailSyncProviderResult>;
  listRecentThreads: (context: EmailSyncConnectionContext) => Promise<EmailThreadMetadata[]>;
  getThreadMetadata: (context: EmailSyncConnectionContext & { externalThreadId: string }) => Promise<EmailThreadMetadata | null>;
  getThreadMessages: (context: EmailSyncConnectionContext & { externalThreadId: string }) => Promise<EmailMessageMetadata[]>;
  linkThreadToMatter: (context: EmailSyncConnectionContext & { matterId: string; thread: EmailThreadMetadata }) => Promise<EmailSyncProviderResult>;
  unlinkThreadFromMatter: (context: EmailSyncConnectionContext & { matterId: string; externalThreadId: string }) => Promise<EmailSyncProviderResult>;
  dryRunEmailPayload: (payload: EmailSyncSendPayload) => EmailSyncSendPayload;
  dryRunThreadImport: (thread: EmailThreadMetadata) => EmailThreadImportPreview;
};

export type EmailSyncProviderEnv = {
  provider: EmailSyncProviderName;
  gmailConfigured: boolean;
  microsoftConfigured: boolean;
  providerConfigured: boolean;
  missingEnv: string[];
};

function getGmailEnv() {
  return {
    clientId: process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GMAIL_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || ""
  };
}

function getMicrosoftEnv() {
  return {
    clientId: process.env.MICROSOFT_EMAIL_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || "",
    clientSecret: process.env.MICROSOFT_EMAIL_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || "",
    tenantId: process.env.MICROSOFT_EMAIL_TENANT_ID || process.env.MICROSOFT_TENANT_ID || "common",
    redirectUri: process.env.MICROSOFT_EMAIL_REDIRECT_URI || process.env.MICROSOFT_REDIRECT_URI || ""
  };
}

export function getEmailSyncProviderName(): EmailSyncProviderName {
  const provider = (process.env.EMAIL_SYNC_PROVIDER || "disabled").trim().toLowerCase();
  if (provider === "gmail" || provider === "microsoft") return provider;
  return "disabled";
}

export function getEmailSyncProviderEnv(): EmailSyncProviderEnv {
  const provider = getEmailSyncProviderName();
  const gmail = getGmailEnv();
  const microsoft = getMicrosoftEnv();
  const gmailConfigured =
    hasConfiguredValue(gmail.clientId) &&
    hasConfiguredSecret(gmail.clientSecret) &&
    hasConfiguredValue(gmail.redirectUri);
  const microsoftConfigured =
    hasConfiguredValue(microsoft.clientId) &&
    hasConfiguredSecret(microsoft.clientSecret) &&
    hasConfiguredValue(microsoft.redirectUri);
  const providerConfigured = (provider === "gmail" && gmailConfigured) || (provider === "microsoft" && microsoftConfigured);

  return {
    provider,
    gmailConfigured,
    microsoftConfigured,
    providerConfigured,
    missingEnv: providerConfigured
      ? []
      : provider === "gmail"
        ? ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REDIRECT_URI"]
        : provider === "microsoft"
          ? [
              "MICROSOFT_EMAIL_CLIENT_ID",
              "MICROSOFT_EMAIL_CLIENT_SECRET",
              "MICROSOFT_EMAIL_TENANT_ID",
              "MICROSOFT_EMAIL_REDIRECT_URI"
            ]
          : ["EMAIL_SYNC_PROVIDER"]
  };
}

export function getGmailOAuthConfig() {
  return getGmailEnv();
}

export function getMicrosoftEmailOAuthConfig() {
  return getMicrosoftEnv();
}

export function getEmailSyncProviderStatus(): ProviderStatus {
  const env = getEmailSyncProviderEnv();

  return buildProviderStatus({
    key: "email_sync",
    label: "Mailbox sync",
    providerName: env.provider,
    configured: env.providerConfigured,
    state: env.provider === "disabled" ? "disabled" : env.providerConfigured ? "configured" : "not_configured",
    missingEnv: env.missingEnv,
    requiredSetupSteps: env.providerConfigured
      ? []
      : [
          "Choose EMAIL_SYNC_PROVIDER.",
          "Add OAuth credentials before connecting Gmail or Outlook.",
          "Use least-privilege scopes and keep mailbox import manual by default."
        ],
    notes: [
      "Transactional email and mailbox sync are separate systems.",
      "Email sync uses minimised metadata by default. Sensitive client documents and visa details should be shared through the secure portal."
    ],
    disabledReason: env.provider === "disabled" ? "Email sync provider not configured." : null
  });
}
