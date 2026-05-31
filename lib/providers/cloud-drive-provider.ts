import type { ProviderStatus, ProviderTestResult } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export type CloudDriveProviderName = "google_drive" | "onedrive" | "disabled";
export type CloudDriveExportType =
  | "matter_folder"
  | "draft_pack"
  | "invoice"
  | "acknowledgement"
  | "selected_documents";

export type CloudDriveConnectionContext = {
  workspaceId: string;
  userId: string;
  provider: CloudDriveProviderName;
  selectedFolderId?: string | null;
};

export type CloudDriveOAuthCallbackInput = CloudDriveConnectionContext & {
  code: string;
};

export type CloudDriveFolderSummary = {
  id: string;
  name: string;
  path?: string | null;
};

export type CloudDriveUploadPayload = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  folderId?: string | null;
};

export type CloudDriveUploadResult = {
  ok: boolean;
  provider: CloudDriveProviderName;
  providerFileId?: string | null;
  providerFolderId?: string | null;
  reason?: string | null;
  dryRun?: boolean;
};

export type CloudDriveProviderResult = {
  ok: boolean;
  provider: CloudDriveProviderName;
  reason?: string | null;
  providerFolderId?: string | null;
  providerFileId?: string | null;
  lastSyncedAt?: string | null;
};

export type CloudDriveManifestItem = {
  path: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sourceEntityType: "document" | "generated_document" | "invoice" | "acknowledgement" | "manifest";
  sourceEntityId: string;
};

export type CloudDriveManifest = {
  workspaceId: string;
  matterId: string;
  exportJobId?: string | null;
  exportType: CloudDriveExportType;
  provider: CloudDriveProviderName;
  exportedByUserId: string;
  exportedAt: string;
  fileCount: number;
  categoriesExported: string[];
  skippedItemsCount: number;
  skippedReasons: string[];
  safetyWarning: string;
  items: CloudDriveManifestItem[];
};

export type CloudDriveExportStatusView = {
  provider: CloudDriveProviderName;
  configured: boolean;
  connected: boolean;
  rootFolderId: string | null;
  selectedFolderId: string | null;
  lastSyncAt: string | null;
  lastErrorSummary: string | null;
};

export type CloudDriveProviderAdapter = {
  getProviderStatus(): ProviderStatus;
  getAuthorizationUrl(context: CloudDriveConnectionContext): string | null;
  handleOAuthCallback(input: CloudDriveOAuthCallbackInput): Promise<CloudDriveProviderResult>;
  refreshToken(context: CloudDriveConnectionContext): Promise<CloudDriveProviderResult>;
  disconnect(context: CloudDriveConnectionContext): Promise<CloudDriveProviderResult>;
  listFolders(context: CloudDriveConnectionContext): Promise<CloudDriveFolderSummary[]>;
  createFolder(context: CloudDriveConnectionContext & { name: string; parentFolderId?: string | null }): Promise<CloudDriveProviderResult>;
  uploadFile(context: CloudDriveConnectionContext & { payload: CloudDriveUploadPayload; dryRun?: boolean }): Promise<CloudDriveUploadResult>;
  exportMatterFolder(context: CloudDriveConnectionContext & { manifest: CloudDriveManifest; dryRun?: boolean }): Promise<CloudDriveProviderResult>;
  exportDraftPack(context: CloudDriveConnectionContext & { manifest: CloudDriveManifest; dryRun?: boolean }): Promise<CloudDriveProviderResult>;
  exportInvoicePdf(context: CloudDriveConnectionContext & { manifest: CloudDriveManifest; dryRun?: boolean }): Promise<CloudDriveProviderResult>;
  exportAcknowledgementRecord(context: CloudDriveConnectionContext & { manifest: CloudDriveManifest; dryRun?: boolean }): Promise<CloudDriveProviderResult>;
  dryRunExportManifest(manifest: CloudDriveManifest): CloudDriveManifest;
  getExportStatus(context: CloudDriveConnectionContext): Promise<CloudDriveExportStatusView>;
};

export type CloudDriveProviderEnv = {
  provider: CloudDriveProviderName;
  googleConfigured: boolean;
  onedriveConfigured: boolean;
  providerConfigured: boolean;
  missingEnv: string[];
};

function getGoogleEnv() {
  return {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || ""
  };
}

function getOneDriveEnv() {
  return {
    clientId: process.env.MICROSOFT_DRIVE_CLIENT_ID || "",
    clientSecret: process.env.MICROSOFT_DRIVE_CLIENT_SECRET || "",
    tenantId: process.env.MICROSOFT_DRIVE_TENANT_ID || "common",
    redirectUri: process.env.MICROSOFT_DRIVE_REDIRECT_URI || ""
  };
}

export function getCloudDriveProviderName(): CloudDriveProviderName {
  const provider = (process.env.CLOUD_DRIVE_PROVIDER || "disabled").trim().toLowerCase();
  if (provider === "google_drive" || provider === "onedrive") return provider;
  return "disabled";
}

export function getCloudDriveProviderEnv(): CloudDriveProviderEnv {
  const provider = getCloudDriveProviderName();
  const google = getGoogleEnv();
  const onedrive = getOneDriveEnv();
  const googleConfigured =
    hasConfiguredValue(google.clientId) &&
    hasConfiguredSecret(google.clientSecret) &&
    hasConfiguredValue(google.redirectUri);
  const onedriveConfigured =
    hasConfiguredValue(onedrive.clientId) &&
    hasConfiguredSecret(onedrive.clientSecret) &&
    hasConfiguredValue(onedrive.redirectUri);
  const providerConfigured = (provider === "google_drive" && googleConfigured) || (provider === "onedrive" && onedriveConfigured);

  return {
    provider,
    googleConfigured,
    onedriveConfigured,
    providerConfigured,
    missingEnv: providerConfigured
      ? []
      : provider === "google_drive"
        ? ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "GOOGLE_DRIVE_REDIRECT_URI"]
        : provider === "onedrive"
          ? [
              "MICROSOFT_DRIVE_CLIENT_ID",
              "MICROSOFT_DRIVE_CLIENT_SECRET",
              "MICROSOFT_DRIVE_TENANT_ID",
              "MICROSOFT_DRIVE_REDIRECT_URI"
            ]
          : ["CLOUD_DRIVE_PROVIDER"]
  };
}

export function getGoogleDriveOAuthConfig() {
  return getGoogleEnv();
}

export function getOneDriveOAuthConfig() {
  return getOneDriveEnv();
}

export function getCloudDriveProviderStatus(): ProviderStatus {
  const env = getCloudDriveProviderEnv();
  return buildProviderStatus({
    key: "cloud_drive",
    label: "Cloud drive export",
    providerName: env.provider,
    configured: env.providerConfigured,
    state: env.provider === "disabled" ? "disabled" : env.providerConfigured ? "configured" : "not_configured",
    missingEnv: env.missingEnv,
    requiredSetupSteps: env.providerConfigured
      ? []
      : [
          "Choose CLOUD_DRIVE_PROVIDER=google_drive or CLOUD_DRIVE_PROVIDER=onedrive.",
          "Configure OAuth credentials before exporting matter folders to a cloud drive provider.",
          "Keep folder names privacy-safe and export only authorised matter records."
        ],
    notes: [
      "Cloud exports are permission-checked and do not expose raw storage URLs.",
      "Sensitive documents should only be exported by authorised users.",
      "Local secure ZIP fallback remains the honest backup when a cloud provider is not configured."
    ],
    disabledReason: env.provider === "disabled" ? "Cloud drive provider not configured." : null
  });
}

export function buildCloudDriveTestResult(input: {
  ok: boolean;
  provider: CloudDriveProviderName;
  reason: string;
}): ProviderTestResult {
  return {
    ok: input.ok,
    reason: input.reason,
    providerName: input.provider
  };
}
