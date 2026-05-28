import type { ProviderStatus } from "@/lib/providers/types";
import { hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getEsignProviderStatus(): ProviderStatus {
  const provider = (process.env.ESIGN_PROVIDER || "internal_acknowledgement").trim().toLowerCase();
  const configured =
    provider === "internal_acknowledgement" ||
    (provider === "docusign" &&
      hasConfiguredValue(process.env.DOCUSIGN_INTEGRATION_KEY) &&
      hasConfiguredValue(process.env.DOCUSIGN_USER_ID) &&
      hasConfiguredSecret(process.env.DOCUSIGN_PRIVATE_KEY) &&
      hasConfiguredValue(process.env.DOCUSIGN_ACCOUNT_ID));

  return {
    key: "esign",
    label: "Client acknowledgement",
    providerName: provider,
    configured,
    state: provider === "disabled" ? "disabled" : configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : provider === "docusign"
        ? ["DOCUSIGN_INTEGRATION_KEY", "DOCUSIGN_USER_ID", "DOCUSIGN_PRIVATE_KEY", "DOCUSIGN_ACCOUNT_ID"]
        : ["ESIGN_PROVIDER"],
    notes: [
      "Internal acknowledgement records are not described as legally binding e-signatures.",
      "Agent review is still required before use."
    ]
  };
}
