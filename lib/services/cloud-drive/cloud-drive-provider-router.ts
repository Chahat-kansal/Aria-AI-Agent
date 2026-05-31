import type {
  CloudDriveConnectionContext,
  CloudDriveProviderAdapter,
  CloudDriveProviderName,
  CloudDriveProviderResult
} from "@/lib/providers/cloud-drive-provider";
import {
  getCloudDriveProviderName,
  getCloudDriveProviderStatus,
  type CloudDriveManifest
} from "@/lib/providers/cloud-drive-provider";
import {
  decodeCloudDriveOAuthState,
  disconnectCloudDriveProvider,
  getCloudDriveAuthorizationUrl,
  handleCloudDriveOAuthCallback,
  refreshCloudDriveProviderTokens
} from "@/lib/services/cloud-drive/cloud-drive-oauth";
import { getWorkspaceProviderConnection, decryptStoredProviderToken } from "@/lib/services/oauth-token-vault";
import { listGoogleDriveFolders, createGoogleDriveFolder, uploadGoogleDriveFile } from "@/lib/services/cloud-drive/google-drive-provider";
import { listOneDriveFolders, createOneDriveFolder, uploadOneDriveFile } from "@/lib/services/cloud-drive/onedrive-provider";

async function getConnectionStatus(context: CloudDriveConnectionContext) {
  const connection = await getWorkspaceProviderConnection(context.workspaceId, "cloud_drive");
  return {
    configured: getCloudDriveProviderStatus().configured,
    connected: Boolean(connection?.connected),
    rootFolderId: typeof connection?.metadataJson?.rootFolderId === "string" ? connection.metadataJson.rootFolderId : null,
    selectedFolderId: typeof connection?.metadataJson?.selectedFolderId === "string" ? connection.metadataJson.selectedFolderId : null,
    lastSyncAt: connection?.lastSyncAt ?? null,
    lastErrorSummary: connection?.lastErrorSummary ?? null
  };
}

async function uploadManifestItems(context: CloudDriveConnectionContext, manifest: CloudDriveManifest, dryRun?: boolean): Promise<CloudDriveProviderResult> {
  const adapter = await getCloudDriveProviderRouter(context);
  let lastFolderId = context.selectedFolderId ?? null;
  for (const item of manifest.items) {
    const folderNameParts = item.path.split("/").slice(0, -1);
    for (const folder of folderNameParts) {
      const created = await adapter.createFolder({ ...context, name: folder, parentFolderId: lastFolderId });
      if (!created.ok) return created;
      lastFolderId = created.providerFolderId ?? lastFolderId;
    }
    const upload = await adapter.uploadFile({
      ...context,
      payload: {
        fileName: item.fileName,
        mimeType: item.mimeType,
        bytes: Buffer.alloc(item.sizeBytes),
        folderId: lastFolderId
      },
      dryRun
    });
    if (!upload.ok) {
      return { ok: false, provider: context.provider, reason: upload.reason ?? "Upload failed." };
    }
  }
  return { ok: true, provider: context.provider, providerFolderId: lastFolderId, lastSyncedAt: new Date().toISOString() };
}

export async function getCloudDriveProviderRouter(context: CloudDriveConnectionContext): Promise<CloudDriveProviderAdapter> {
  const provider: CloudDriveProviderName = context.provider !== "disabled" ? context.provider : getCloudDriveProviderName();
  return {
    getProviderStatus: () => getCloudDriveProviderStatus(),
    getAuthorizationUrl: getCloudDriveAuthorizationUrl,
    handleOAuthCallback: handleCloudDriveOAuthCallback,
    refreshToken: refreshCloudDriveProviderTokens,
    disconnect: disconnectCloudDriveProvider,
    listFolders(requestContext) {
      if (provider === "google_drive") return listGoogleDriveFolders(requestContext);
      if (provider === "onedrive") return listOneDriveFolders(requestContext);
      return Promise.resolve([]);
    },
    createFolder(requestContext) {
      if (provider === "google_drive") return createGoogleDriveFolder(requestContext);
      if (provider === "onedrive") return createOneDriveFolder(requestContext);
      return Promise.resolve({ ok: false, provider: "disabled", reason: "Cloud drive provider not configured." });
    },
    uploadFile(requestContext) {
      if (provider === "google_drive") return uploadGoogleDriveFile(requestContext);
      if (provider === "onedrive") return uploadOneDriveFile(requestContext);
      return Promise.resolve({ ok: false, provider: "disabled", reason: "Cloud drive provider not configured." });
    },
    exportMatterFolder(requestContext) {
      return uploadManifestItems(requestContext, requestContext.manifest, requestContext.dryRun);
    },
    exportDraftPack(requestContext) {
      return uploadManifestItems(requestContext, requestContext.manifest, requestContext.dryRun);
    },
    exportInvoicePdf(requestContext) {
      return uploadManifestItems(requestContext, requestContext.manifest, requestContext.dryRun);
    },
    exportAcknowledgementRecord(requestContext) {
      return uploadManifestItems(requestContext, requestContext.manifest, requestContext.dryRun);
    },
    dryRunExportManifest(manifest) {
      return manifest;
    },
    async getExportStatus(requestContext) {
      return { provider, ...(await getConnectionStatus(requestContext)) };
    }
  };
}

export async function resolveCloudDriveOAuthCallbackState(state: string | null | undefined) {
  return decodeCloudDriveOAuthState(state);
}

export async function getCloudDriveConnectedAccountLabel(workspaceId: string) {
  const connection = await getWorkspaceProviderConnection(workspaceId, "cloud_drive");
  return connection?.connectedAccountLabel ?? null;
}

export async function getCloudDriveAccessTokenPresent(workspaceId: string) {
  const connection = await getWorkspaceProviderConnection(workspaceId, "cloud_drive");
  return Boolean(decryptStoredProviderToken(connection?.encryptedAccessToken));
}
