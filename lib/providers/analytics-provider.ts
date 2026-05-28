import type { ProviderStatus } from "@/lib/providers/types";
import { hasConfiguredValue } from "@/lib/providers/shared";

export function getAnalyticsProviderStatus(): ProviderStatus {
  const provider = (process.env.ANALYTICS_PROVIDER || "disabled").trim().toLowerCase();
  const configured =
    (provider === "posthog" && hasConfiguredValue(process.env.NEXT_PUBLIC_POSTHOG_KEY) && hasConfiguredValue(process.env.NEXT_PUBLIC_POSTHOG_HOST)) ||
    (provider === "plausible" && hasConfiguredValue(process.env.PLAUSIBLE_DOMAIN));

  return {
    key: "analytics",
    label: "Analytics",
    providerName: provider,
    configured,
    state: provider === "disabled" ? "disabled" : configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : provider === "posthog"
        ? ["NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST"]
        : provider === "plausible"
          ? ["PLAUSIBLE_DOMAIN"]
          : ["ANALYTICS_PROVIDER"],
    notes: [
      "Only aggregated product events should be tracked.",
      "No client names, passport numbers, DOBs, grant numbers, document text, snippets, or raw URLs should be sent."
    ]
  };
}
