import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  getEmailSyncProviderName,
  getGmailOAuthConfig,
  getMicrosoftEmailOAuthConfig,
  type EmailSyncConnectionContext,
  type EmailSyncOAuthCallbackInput,
  type EmailSyncProviderResult
} from "@/lib/providers/email-sync-provider";
import { auditEvent } from "@/lib/services/audit";
import {
  decryptStoredProviderToken,
  getWorkspaceProviderConnection,
  markWorkspaceProviderDisconnected,
  upsertWorkspaceProviderConnection
} from "@/lib/services/oauth-token-vault";
import { redactEmailSyncError } from "@/lib/services/email-sync/email-sync-redaction";

type OAuthStatePayload = {
  workspaceId: string;
  userId: string;
  provider: string;
  nonce: string;
};

function encodeState(payload: OAuthStatePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeEmailSyncOAuthState(state: string | null | undefined) {
  if (!state) return null;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!parsed.workspaceId || !parsed.userId || !parsed.provider) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function auditMailboxEvent(input: {
  workspaceId: string;
  userId: string;
  action: string;
  metadata?: Prisma.InputJsonObject;
}) {
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "EmailSync",
    entityId: "email_sync",
    action: input.action,
    metadata: input.metadata
  });
}

export function getEmailSyncAuthorizationUrl(context: EmailSyncConnectionContext) {
  const provider = getEmailSyncProviderName();
  const state = encodeState({
    workspaceId: context.workspaceId,
    userId: context.userId,
    provider,
    nonce: crypto.randomBytes(12).toString("hex")
  });

  if (provider === "gmail") {
    const config = getGmailOAuthConfig();
    if (!config.clientId || !config.redirectUri) return null;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.metadata"
      ].join(" "),
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (provider === "microsoft") {
    const config = getMicrosoftEmailOAuthConfig();
    if (!config.clientId || !config.redirectUri) return null;
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      response_mode: "query",
      scope: ["offline_access", "Mail.Send", "Mail.ReadBasic"].join(" "),
      state
    });
    return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  return null;
}

async function exchangeGoogleCode(code: string) {
  const config = getGmailOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) throw new Error(`Gmail OAuth exchange failed: ${response.status}`);
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

async function exchangeMicrosoftCode(code: string) {
  const config = getMicrosoftEmailOAuthConfig();
  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      scope: ["offline_access", "Mail.Send", "Mail.ReadBasic"].join(" ")
    })
  });
  if (!response.ok) throw new Error(`Microsoft email OAuth exchange failed: ${response.status}`);
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

export async function handleEmailSyncOAuthCallback(input: EmailSyncOAuthCallbackInput): Promise<EmailSyncProviderResult> {
  try {
    const provider = getEmailSyncProviderName();
    const tokenResponse = provider === "gmail"
      ? await exchangeGoogleCode(input.code)
      : provider === "microsoft"
        ? await exchangeMicrosoftCode(input.code)
        : null;
    if (!tokenResponse?.access_token) {
      throw new Error("Email sync provider is not configured.");
    }

    await upsertWorkspaceProviderConnection({
      workspaceId: input.workspaceId,
      key: "email_sync",
      providerName: provider,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      tokenExpiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : null,
      scopes: tokenResponse.scope ? tokenResponse.scope.split(/\s+/).filter(Boolean) : [],
      connectedAccountLabel: provider === "gmail" ? "Connected Gmail mailbox" : "Connected Outlook mailbox",
      lastSuccessfulActionAt: new Date(),
      lastErrorSummary: null
    });
    await auditMailboxEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: "email_sync.provider_connected",
      metadata: { provider }
    });
    return { ok: true, provider, lastSyncedAt: new Date().toISOString() };
  } catch (error) {
    const reason = redactEmailSyncError(error instanceof Error ? error.message : String(error));
    await auditMailboxEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: "email_sync.sync_failed",
      metadata: { provider: getEmailSyncProviderName(), reason }
    });
    return { ok: false, provider: getEmailSyncProviderName(), reason };
  }
}

async function refreshGoogleToken(refreshToken: string) {
  const config = getGmailOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) throw new Error(`Gmail token refresh failed: ${response.status}`);
  return response.json() as Promise<{ access_token: string; expires_in?: number; scope?: string }>;
}

async function refreshMicrosoftToken(refreshToken: string) {
  const config = getMicrosoftEmailOAuthConfig();
  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: ["offline_access", "Mail.Send", "Mail.ReadBasic"].join(" ")
    })
  });
  if (!response.ok) throw new Error(`Microsoft email token refresh failed: ${response.status}`);
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>;
}

export async function refreshEmailSyncToken(context: EmailSyncConnectionContext): Promise<EmailSyncProviderResult> {
  try {
    const connection = await getWorkspaceProviderConnection(context.workspaceId, "email_sync");
    const refreshToken = decryptStoredProviderToken(connection?.encryptedRefreshToken);
    if (!refreshToken) throw new Error("No refresh token is available for mailbox sync.");

    const provider = getEmailSyncProviderName();
    const tokenResponse = provider === "gmail"
      ? await refreshGoogleToken(refreshToken)
      : provider === "microsoft"
        ? await refreshMicrosoftToken(refreshToken)
        : null;
    if (!tokenResponse?.access_token) throw new Error("Email sync provider is not configured.");

    const nextRefreshToken =
      "refresh_token" in tokenResponse && typeof tokenResponse.refresh_token === "string"
        ? tokenResponse.refresh_token
        : refreshToken;

    await upsertWorkspaceProviderConnection({
      workspaceId: context.workspaceId,
      key: "email_sync",
      providerName: provider,
      accessToken: tokenResponse.access_token,
      refreshToken: nextRefreshToken,
      tokenExpiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : null,
      scopes: tokenResponse.scope ? tokenResponse.scope.split(/\s+/).filter(Boolean) : connection?.scopes ?? [],
      connectedAccountLabel: connection?.connectedAccountLabel ?? null,
      lastSuccessfulActionAt: new Date(),
      lastErrorSummary: null,
      metadataJson: connection?.metadataJson ?? null
    });
    await auditMailboxEvent({
      workspaceId: context.workspaceId,
      userId: context.userId,
      action: "email_sync.token_refreshed",
      metadata: { provider }
    });
    return { ok: true, provider, lastSyncedAt: new Date().toISOString() };
  } catch (error) {
    return {
      ok: false,
      provider: getEmailSyncProviderName(),
      reason: redactEmailSyncError(error instanceof Error ? error.message : String(error))
    };
  }
}

export async function disconnectEmailSyncProvider(context: EmailSyncConnectionContext): Promise<EmailSyncProviderResult> {
  await markWorkspaceProviderDisconnected({
    workspaceId: context.workspaceId,
    key: "email_sync",
    providerName: getEmailSyncProviderName(),
    revokeTokens: true,
    lastErrorSummary: null
  });
  await auditMailboxEvent({
    workspaceId: context.workspaceId,
    userId: context.userId,
    action: "email_sync.provider_disconnected",
    metadata: { provider: getEmailSyncProviderName() }
  });
  await auditMailboxEvent({
    workspaceId: context.workspaceId,
    userId: context.userId,
    action: "email_sync.token_revoked",
    metadata: { provider: getEmailSyncProviderName() }
  });
  return { ok: true, provider: getEmailSyncProviderName() };
}
