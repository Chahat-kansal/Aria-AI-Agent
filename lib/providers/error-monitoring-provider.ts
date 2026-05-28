import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getErrorMonitoringProviderStatus(): ProviderStatus {
  const configured = hasConfiguredValue(process.env.SENTRY_DSN);
  return buildProviderStatus({
    key: "monitoring",
    label: "Error monitoring",
    providerName: configured ? "sentry" : "not configured",
    configured,
    state: configured ? "configured" : "not_configured",
    missingEnv: configured ? [] : ["SENTRY_DSN"],
    requiredSetupSteps: configured ? [] : ["Add SENTRY_DSN.", "Keep redaction rules in place before routing live errors to Sentry."],
    notes: [
      "Sensitive fields, tokens, raw URLs, document text, and AI payloads must be redacted before capture.",
      "Optional release upload configuration can be added later with SENTRY_AUTH_TOKEN."
    ]
  });
}
