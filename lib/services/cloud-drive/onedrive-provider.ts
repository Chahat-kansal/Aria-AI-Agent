import type {
  CloudDriveConnectionContext,
  CloudDriveFolderSummary,
  CloudDriveProviderResult,
  CloudDriveUploadPayload,
  CloudDriveUploadResult
} from "@/lib/providers/cloud-drive-provider";
import { decryptStoredProviderToken, getWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { redactCloudDriveError } from "@/lib/services/cloud-drive/cloud-drive-redaction";

async function oneDriveRequest<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`OneDrive request failed: ${response.status}`);
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

async function getAccessToken(context: CloudDriveConnectionContext) {
  const connection = await getWorkspaceProviderConnection(context.workspaceId, "cloud_drive");
  return decryptStoredProviderToken(connection?.encryptedAccessToken);
}

export async function listOneDriveFolders(context: CloudDriveConnectionContext): Promise<CloudDriveFolderSummary[]> {
  const accessToken = await getAccessToken(context);
  if (!accessToken) return [];
  try {
    const response = await oneDriveRequest<{ value?: Array<{ id: string; name: string; parentReference?: { path?: string } }> }>(
      accessToken,
      "/me/drive/root/children?$select=id,name,parentReference,folder"
    );
    return (response.value ?? []).map((folder) => ({
      id: folder.id,
      name: folder.name,
      path: folder.parentReference?.path ?? null
    }));
  } catch {
    return [];
  }
}

export async function createOneDriveFolder(context: CloudDriveConnectionContext & { name: string; parentFolderId?: string | null }): Promise<CloudDriveProviderResult> {
  const accessToken = await getAccessToken(context);
  if (!accessToken) return { ok: false, provider: "onedrive", reason: "OneDrive is not connected." };
  try {
    const response = await oneDriveRequest<{ id?: string }>(
      accessToken,
      context.parentFolderId ? `/me/drive/items/${encodeURIComponent(context.parentFolderId)}/children` : "/me/drive/root/children",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: context.name,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename"
        })
      }
    );
    return { ok: true, provider: "onedrive", providerFolderId: response.id ?? null, lastSyncedAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false, provider: "onedrive", reason: redactCloudDriveError(error) };
  }
}

export async function uploadOneDriveFile(input: CloudDriveConnectionContext & { payload: CloudDriveUploadPayload; dryRun?: boolean }): Promise<CloudDriveUploadResult> {
  if (input.dryRun) {
    return { ok: true, provider: "onedrive", providerFileId: "dry-run-onedrive-file", dryRun: true };
  }
  const accessToken = await getAccessToken(input);
  if (!accessToken) return { ok: false, provider: "onedrive", reason: "OneDrive is not connected." };
  try {
    const base = input.payload.folderId
      ? `/me/drive/items/${encodeURIComponent(input.payload.folderId)}:/`
      : "/me/drive/root:/";
    const response = await fetch(`https://graph.microsoft.com/v1.0${base}${encodeURIComponent(input.payload.fileName)}:/content`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": input.payload.mimeType
      },
      body: new Uint8Array(input.payload.bytes)
    });
    if (!response.ok) throw new Error(`OneDrive upload failed: ${response.status}`);
    const parsed = await response.json() as { id?: string };
    return { ok: true, provider: "onedrive", providerFileId: parsed.id ?? null };
  } catch (error) {
    return { ok: false, provider: "onedrive", reason: redactCloudDriveError(error) };
  }
}
