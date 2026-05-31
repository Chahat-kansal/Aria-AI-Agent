import type { CloudDriveConnectionContext, CloudDriveOAuthCallbackInput, CloudDriveProviderName, CloudDriveProviderResult } from "@/lib/providers/cloud-drive-provider";
import { getCloudDriveProviderName, getGoogleDriveOAuthConfig, getOneDriveOAuthConfig } from "@/lib/providers/cloud-drive-provider";
import { auditEvent } from "@/lib/services/audit";
import { markWorkspaceProviderDisconnected, upsertWorkspaceProviderConnection, getWorkspaceProviderConnection, decryptStoredProviderToken } from "@/lib/services/oauth-token-vault";
import { redactCloudDriveError } from "@/lib/services/cloud-drive/cloud-drive-redaction";

function encodeState(context: CloudDriveConnectionContext) {
  return Buffer.from(JSON.stringify(context), "utf8").toString("base64url");
}

export function decodeCloudDriveOAuthState(state: string | null | undefined): CloudDriveConnectionContext | null {
  if (!state) return null;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.workspaceId !== "string" || typeof parsed.userId !== "string") return null;
    return {
      workspaceId: parsed.workspaceId,
      userId: parsed.userId,
      provider: parsed.provider === "google_drive" || parsed.provider === "onedrive" ? parsed.provider : getCloudDriveProviderName(),
      selectedFolderId: typeof parsed.selectedFolderId === "string" ? parsed.selectedFolderId : null
    };
  } catch {
    return null;
  }
}

export function getCloudDriveAuthorizationUrl(context: CloudDriveConnectionContext) {
  const provider = getCloudDriveProviderName();
  if (provider === "google_drive") {
    const config = getGoogleDriveOAuthConfig();
    if (!config.clientId || !config.redirectUri) return null;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly",
      state: encodeState({ ...context, provider })
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  if (provider === "onedrive") {
    const config = getOneDriveOAuthConfig();
    if (!config.clientId || !config.redirectUri) return null;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "offline_access Files.ReadWrite.AppFolder Files.ReadWrite",
      state: encodeState({ ...context, provider })
    });
    return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }
  return null;
}

export async function handleCloudDriveOAuthCallback(input: CloudDriveOAuthCallbackInput): Promise<CloudDriveProviderResult> {
  const provider = getCloudDriveProviderName();
  try {
    await upsertWorkspaceProviderConnection({
      workspaceId: input.workspaceId,
      key: "cloud_drive",
      providerName: provider,
      accessToken: `demo-${provider}-access-token`,
      refreshToken: `demo-${provider}-refresh-token`,
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      scopes: provider === "google_drive"
        ? ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.metadata.readonly"]
        : ["offline_access", "Files.ReadWrite.AppFolder", "Files.ReadWrite"],
      connectedAccountLabel: `${provider.replace("_", " ")} connected account`,
      metadataJson: {
        selectedFolderId: input.selectedFolderId ?? null
      },
      lastSuccessfulActionAt: new Date(),
      lastErrorSummary: null
    });
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "CloudDriveProvider",
      entityId: provider,
      action: "cloud_drive.provider_connected",
      metadata: { provider }
    });
    return { ok: true, provider, lastSyncedAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false, provider, reason: redactCloudDriveError(error) };
  }
}

export async function refreshCloudDriveProviderTokens(context: CloudDriveConnectionContext): Promise<CloudDriveProviderResult> {
  const connection = await getWorkspaceProviderConnection(context.workspaceId, "cloud_drive");
  const provider = connection?.providerName as CloudDriveProviderName || getCloudDriveProviderName();
  if (!connection?.encryptedRefreshToken) {
    return { ok: false, provider, reason: "Cloud drive provider is not connected." };
  }
  const refreshToken = decryptStoredProviderToken(connection.encryptedRefreshToken);
  if (!refreshToken) {
    return { ok: false, provider, reason: "Cloud drive refresh token is unavailable." };
  }

  await upsertWorkspaceProviderConnection({
    workspaceId: context.workspaceId,
    key: "cloud_drive",
    providerName: provider,
    accessToken: refreshToken.startsWith("demo-") ? refreshToken.replace("refresh", "access") : refreshToken,
    refreshToken,
    tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scopes: connection.scopes,
    connectedAccountLabel: connection.connectedAccountLabel,
    metadataJson: connection.metadataJson ?? null,
    lastSuccessfulActionAt: new Date(),
    lastErrorSummary: null
  });
  await auditEvent({
    workspaceId: context.workspaceId,
    userId: context.userId,
    entityType: "CloudDriveProvider",
    entityId: provider,
    action: "cloud_drive.token_refreshed",
    metadata: { provider }
  });
  return { ok: true, provider, lastSyncedAt: new Date().toISOString() };
}

export async function disconnectCloudDriveProvider(context: CloudDriveConnectionContext): Promise<CloudDriveProviderResult> {
  const provider = getCloudDriveProviderName();
  await markWorkspaceProviderDisconnected({
    workspaceId: context.workspaceId,
    key: "cloud_drive",
    providerName: provider,
    revokeTokens: true,
    lastErrorSummary: null
  });
  await auditEvent({
    workspaceId: context.workspaceId,
    userId: context.userId,
    entityType: "CloudDriveProvider",
    entityId: provider,
    action: "cloud_drive.provider_disconnected",
    metadata: { provider }
  });
  return { ok: true, provider, lastSyncedAt: new Date().toISOString() };
}
