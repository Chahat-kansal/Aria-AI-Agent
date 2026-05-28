import type { ProviderStatus } from "@/lib/providers/types";
import { hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getErrorMonitoringProviderStatus(): ProviderStatus {
  const configured = hasConfiguredValue(process.env.SENTRY_DSN);
  return {
    key: "monitoring",
    label: "Error monitoring",
    providerName: configured ? "sentry" : "not configured",
    configured,
    state: configured ? "configured" : "not_configured",
    missingEnv: configured ? [] : ["SENTRY_DSN"],
    notes: [
      "Sensitive fields, tokens, raw URLs, document text, and AI payloads must be redacted before capture.",
      "Optional release upload configuration can be added later with SENTRY_AUTH_TOKEN."
    ]
  };
}
