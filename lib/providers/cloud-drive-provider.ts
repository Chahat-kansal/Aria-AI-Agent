import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getCloudDriveProviderStatus(): ProviderStatus {
  const provider = (process.env.CLOUD_DRIVE_PROVIDER || "disabled").trim().toLowerCase();
  const googleConfigured =
    hasConfiguredValue(process.env.GOOGLE_CLIENT_ID) &&
    hasConfiguredSecret(process.env.GOOGLE_CLIENT_SECRET) &&
    hasConfiguredValue(process.env.GOOGLE_REDIRECT_URI);
  const microsoftConfigured =
    hasConfiguredValue(process.env.MICROSOFT_CLIENT_ID) &&
    hasConfiguredSecret(process.env.MICROSOFT_CLIENT_SECRET) &&
    hasConfiguredValue(process.env.MICROSOFT_REDIRECT_URI);
  const configured = (provider === "google-drive" && googleConfigured) || (provider === "onedrive" && microsoftConfigured);

  return buildProviderStatus({
    key: "cloud_drive",
    label: "Cloud drive export",
    providerName: provider,
    configured,
    state: provider === "disabled" ? "disabled" : configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : provider === "google-drive"
        ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]
        : provider === "onedrive"
          ? ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"]
          : ["CLOUD_DRIVE_PROVIDER"],
    requiredSetupSteps: configured ? [] : ["Choose CLOUD_DRIVE_PROVIDER.", "Configure OAuth credentials before exporting matter folders to a drive provider."],
    notes: [
      "Exports must use secure server-side retrieval and never expose raw storage URLs.",
      "Platform admin must not export private client files."
    ],
    disabledReason: provider === "disabled" ? "Cloud drive export is disabled until a provider is configured." : null
  });
}
