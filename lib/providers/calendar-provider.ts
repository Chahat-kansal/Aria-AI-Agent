import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getCalendarProviderStatus(): ProviderStatus {
  const provider = (process.env.CALENDAR_PROVIDER || "disabled").trim().toLowerCase();
  const googleConfigured =
    hasConfiguredValue(process.env.GOOGLE_CLIENT_ID) &&
    hasConfiguredSecret(process.env.GOOGLE_CLIENT_SECRET) &&
    hasConfiguredValue(process.env.GOOGLE_REDIRECT_URI);
  const microsoftConfigured =
    hasConfiguredValue(process.env.MICROSOFT_CLIENT_ID) &&
    hasConfiguredSecret(process.env.MICROSOFT_CLIENT_SECRET) &&
    hasConfiguredValue(process.env.MICROSOFT_REDIRECT_URI);
  const configured = (provider === "google" && googleConfigured) || (provider === "microsoft" && microsoftConfigured);

  return buildProviderStatus({
    key: "calendar",
    label: "Calendar sync",
    providerName: provider,
    configured,
    state: provider === "disabled" ? "disabled" : configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : provider === "google"
        ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]
        : provider === "microsoft"
          ? ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"]
          : ["CALENDAR_PROVIDER"],
    requiredSetupSteps: configured ? [] : ["Choose CALENDAR_PROVIDER.", "Add OAuth credentials before enabling live availability or event sync."],
    notes: [
      "Calendar event titles must stay generic and avoid sensitive migration facts.",
      "Appointment booking fallback must remain available even without a provider connection."
    ],
    disabledReason: provider === "disabled" ? "Calendar sync is disabled until a provider is configured." : null
  });
}
