import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus } from "@/lib/providers/shared";

export function getMobileProviderStatus(): ProviderStatus {
  return buildProviderStatus({
    key: "mobile",
    label: "Mobile experience",
    providerName: "progressive-web-app",
    configured: true,
    state: "configured",
    missingEnv: [],
    requiredSetupSteps: [],
    notes: [
      "Mobile support is delivered through the secure web and client portal experience.",
      "This does not claim native iOS or Android app availability."
    ]
  });
}
