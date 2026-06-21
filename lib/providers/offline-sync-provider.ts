import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus } from "@/lib/providers/shared";

export function getOfflineSyncProviderStatus(): ProviderStatus {
  return buildProviderStatus({
    key: "offline_sync",
    label: "Offline sync",
    providerName: "browser-safe-mode",
    configured: true,
    state: "configured",
    missingEnv: [],
    requiredSetupSteps: ["Keep offline support limited to low-risk task metadata.", "Do not cache sensitive client document content offline by default."],
    notes: [
      "Offline support is limited to low-risk task metadata and safe note drafts only.",
      "Sensitive client documents and extracted text must not be cached offline by default."
    ],
    disabledReason: null
  });
}
