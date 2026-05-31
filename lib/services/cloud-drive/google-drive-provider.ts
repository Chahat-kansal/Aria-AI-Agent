import type {
  CloudDriveConnectionContext,
  CloudDriveFolderSummary,
  CloudDriveProviderResult,
  CloudDriveUploadPayload,
  CloudDriveUploadResult
} from "@/lib/providers/cloud-drive-provider";
import { decryptStoredProviderToken, getWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { redactCloudDriveError } from "@/lib/services/cloud-drive/cloud-drive-redaction";

async function googleDriveRequest<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`Google Drive request failed: ${response.status}`);
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

async function getAccessToken(context: CloudDriveConnectionContext) {
  const connection = await getWorkspaceProviderConnection(context.workspaceId, "cloud_drive");
  return decryptStoredProviderToken(connection?.encryptedAccessToken);
}

export async function listGoogleDriveFolders(context: CloudDriveConnectionContext): Promise<CloudDriveFolderSummary[]> {
  const accessToken = await getAccessToken(context);
  if (!accessToken) return [];
  try {
    const response = await googleDriveRequest<{ files?: Array<{ id: string; name: string }> }>(
      accessToken,
      "/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)&pageSize=20"
    );
    return (response.files ?? []).map((folder) => ({ id: folder.id, name: folder.name }));
  } catch {
    return [];
  }
}

export async function createGoogleDriveFolder(context: CloudDriveConnectionContext & { name: string; parentFolderId?: string | null }): Promise<CloudDriveProviderResult> {
  const accessToken = await getAccessToken(context);
  if (!accessToken) return { ok: false, provider: "google_drive", reason: "Google Drive is not connected." };
  try {
    const response = await googleDriveRequest<{ id?: string }>(accessToken, "/files?fields=id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: context.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: context.parentFolderId ? [context.parentFolderId] : undefined
      })
    });
    return { ok: true, provider: "google_drive", providerFolderId: response.id ?? null, lastSyncedAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false, provider: "google_drive", reason: redactCloudDriveError(error) };
  }
}

export async function uploadGoogleDriveFile(input: CloudDriveConnectionContext & { payload: CloudDriveUploadPayload; dryRun?: boolean }): Promise<CloudDriveUploadResult> {
  if (input.dryRun) {
    return { ok: true, provider: "google_drive", providerFileId: "dry-run-google-drive-file", dryRun: true };
  }
  const accessToken = await getAccessToken(input);
  if (!accessToken) return { ok: false, provider: "google_drive", reason: "Google Drive is not connected." };
  try {
    const metadata = {
      name: input.payload.fileName,
      parents: input.payload.folderId ? [input.payload.folderId] : undefined
    };
    const boundary = `aria-${Date.now()}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`, "utf8"),
      Buffer.from(`--${boundary}\r\nContent-Type: ${input.payload.mimeType}\r\n\r\n`, "utf8"),
      input.payload.bytes,
      Buffer.from(`\r\n--${boundary}--`, "utf8")
    ]);
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body
    });
    if (!response.ok) throw new Error(`Google Drive upload failed: ${response.status}`);
    const parsed = await response.json() as { id?: string };
    return { ok: true, provider: "google_drive", providerFileId: parsed.id ?? null };
  } catch (error) {
    return { ok: false, provider: "google_drive", reason: redactCloudDriveError(error) };
  }
}
