import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getEmailSyncProviderStatus(): ProviderStatus {
  const provider = (process.env.EMAIL_SYNC_PROVIDER || "disabled").trim().toLowerCase();
  const gmailConfigured =
    hasConfiguredValue(process.env.GOOGLE_CLIENT_ID) &&
    hasConfiguredSecret(process.env.GOOGLE_CLIENT_SECRET) &&
    hasConfiguredValue(process.env.GOOGLE_REDIRECT_URI);
  const outlookConfigured =
    hasConfiguredValue(process.env.MICROSOFT_CLIENT_ID) &&
    hasConfiguredSecret(process.env.MICROSOFT_CLIENT_SECRET) &&
    hasConfiguredValue(process.env.MICROSOFT_REDIRECT_URI);
  const configured = (provider === "gmail" && gmailConfigured) || (provider === "outlook" && outlookConfigured);

  return buildProviderStatus({
    key: "email_sync",
    label: "Mailbox sync",
    providerName: provider,
    configured,
    state: provider === "disabled" ? "disabled" : configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : provider === "gmail"
        ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]
        : provider === "outlook"
          ? ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"]
          : ["EMAIL_SYNC_PROVIDER"],
    requiredSetupSteps: configured ? [] : ["Choose EMAIL_SYNC_PROVIDER.", "Use least-privilege OAuth scopes and keep mailbox import manual by default."],
    notes: [
      "Transactional email and mailbox sync are separate systems.",
      "Mailbox content must not be broadly ingested or exposed to platform admin."
    ],
    disabledReason: provider === "disabled" ? "Mailbox sync is disabled until a provider is configured." : null
  });
}
