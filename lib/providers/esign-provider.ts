import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getEsignProviderStatus(): ProviderStatus {
  const provider = (process.env.ESIGN_PROVIDER || "internal_acknowledgement").trim().toLowerCase();
  const configured =
    provider === "internal_acknowledgement" ||
    (provider === "docusign" &&
      hasConfiguredValue(process.env.DOCUSIGN_INTEGRATION_KEY) &&
      hasConfiguredValue(process.env.DOCUSIGN_USER_ID) &&
      hasConfiguredSecret(process.env.DOCUSIGN_PRIVATE_KEY) &&
      hasConfiguredValue(process.env.DOCUSIGN_ACCOUNT_ID));

  return buildProviderStatus({
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
    requiredSetupSteps: configured ? [] : provider === "docusign"
      ? ["Add DocuSign credentials.", "Complete legal review before using any legally binding e-signature workflow."]
      : ["Internal acknowledgement is available now.", "Configure an external provider only if the firm needs it."],
    notes: [
      "Internal acknowledgement records are not described as legally binding e-signatures.",
      "Agent review is still required before use."
    ],
    disabledReason: provider === "disabled" ? "Client acknowledgement has been explicitly disabled." : null
  });
}
