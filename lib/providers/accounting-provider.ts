import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getAccountingProviderStatus(): ProviderStatus {
  const provider = (process.env.ACCOUNTING_PROVIDER || "disabled").trim().toLowerCase();
  const xeroConfigured =
    hasConfiguredValue(process.env.XERO_CLIENT_ID) &&
    hasConfiguredSecret(process.env.XERO_CLIENT_SECRET) &&
    hasConfiguredValue(process.env.XERO_REDIRECT_URI);
  const myobConfigured =
    hasConfiguredValue(process.env.MYOB_CLIENT_ID) &&
    hasConfiguredSecret(process.env.MYOB_CLIENT_SECRET) &&
    hasConfiguredValue(process.env.MYOB_REDIRECT_URI);
  const configured = (provider === "xero" && xeroConfigured) || (provider === "myob" && myobConfigured);

  return buildProviderStatus({
    key: "accounting",
    label: "Accounting",
    providerName: provider,
    configured,
    state: provider === "disabled" ? "disabled" : configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : provider === "xero"
        ? ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET", "XERO_REDIRECT_URI"]
        : provider === "myob"
          ? ["MYOB_CLIENT_ID", "MYOB_CLIENT_SECRET", "MYOB_REDIRECT_URI"]
          : ["ACCOUNTING_PROVIDER"],
    requiredSetupSteps: configured
      ? []
      : ["Choose ACCOUNTING_PROVIDER.", "Add OAuth client credentials before testing invoice sync or CSV fallback handoff."],
    notes: [
      "Only billing-safe invoice fields should be sent to accounting providers.",
      "Trust accounting obligations must be reviewed with an accountant/legal professional."
    ],
    disabledReason: provider === "disabled" ? "Accounting sync is disabled until a provider is configured." : null
  });
}
