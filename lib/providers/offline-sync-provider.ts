import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus } from "@/lib/providers/shared";

export function getOfflineSyncProviderStatus(): ProviderStatus {
  return buildProviderStatus({
    key: "offline_sync",
    label: "Offline sync",
    providerName: "browser-safe-mode",
    configured: false,
    state: "disabled",
    missingEnv: [],
    requiredSetupSteps: ["Implement encrypted low-risk offline metadata storage before enabling sync.", "Do not cache sensitive client document content offline by default."],
    notes: [
      "Offline support must stay limited to low-risk metadata unless explicit encryption and policy controls exist.",
      "Sensitive client documents and extracted text must not be cached offline by default."
    ],
    disabledReason: "Offline sync is intentionally disabled until the safe-mode implementation is complete."
  });
}
