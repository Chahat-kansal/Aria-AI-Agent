import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getStorageProviderStatus(): ProviderStatus {
  const supabaseConfigured =
    hasConfiguredValue(process.env.SUPABASE_URL) &&
    hasConfiguredSecret(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    hasConfiguredValue(process.env.SUPABASE_PRIVATE_DOCUMENT_BUCKET);

  if (supabaseConfigured) {
    return buildProviderStatus({
      key: "storage",
      label: "Storage",
      providerName: "supabase-private-bucket",
      configured: true,
      state: "configured",
      missingEnv: [],
      requiredSetupSteps: [],
      notes: [
        "Documents must stay in private storage and be served through permission-checked download routes only.",
        "Raw document URLs must never be exposed in client or staff UI."
      ]
    });
  }

  const legacyProvider = (process.env.STORAGE_PROVIDER || "database").trim().toLowerCase();
  const legacyConfigured =
    legacyProvider === "database" ||
    legacyProvider === "local" ||
    (legacyProvider === "vercel-blob" && hasConfiguredSecret(process.env.BLOB_READ_WRITE_TOKEN));

  return buildProviderStatus({
    key: "storage",
    label: "Storage",
    providerName: legacyConfigured ? `legacy-${legacyProvider}` : "not configured",
    configured: legacyConfigured,
    state: legacyConfigured ? "configured" : "not_configured",
    missingEnv: legacyConfigured ? [] : ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PRIVATE_DOCUMENT_BUCKET"],
    requiredSetupSteps: legacyConfigured ? [] : ["Configure the Supabase private document bucket for production-hardened storage."],
    notes: [
      "Supabase private bucket is the preferred production target for document storage hardening.",
      "Legacy storage support remains available for existing environments."
    ]
  });
}
