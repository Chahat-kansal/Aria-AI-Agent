import { auditEvent } from "@/lib/services/audit";
import {
  decryptStoredProviderToken,
  getWorkspaceProviderConnection,
  markWorkspaceProviderDisconnected,
  upsertWorkspaceProviderConnection
} from "@/lib/services/oauth-token-vault";
import {
  getCalendarProviderName,
  getGoogleCalendarOAuthConfig,
  getMicrosoftCalendarOAuthConfig,
  type CalendarConnectionContext,
  type CalendarOAuthCallbackInput,
  type CalendarProviderName,
  type CalendarProviderResult
} from "@/lib/providers/calendar-provider";
import { sanitizeCalendarError } from "@/lib/services/calendar/calendar-safety";

const GOOGLE_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.readonly"];
const MICROSOFT_SCOPES = ["offline_access", "User.Read", "Calendars.ReadWrite", "Calendars.Read"];

function encodeState(context: CalendarConnectionContext) {
  return Buffer.from(JSON.stringify(context)).toString("base64url");
}

export function decodeCalendarOAuthState(state: string | null | undefined) {
  if (!state) return null;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as CalendarConnectionContext;
    return parsed;
  } catch {
    return null;
  }
}

async function auditCalendarProviderAction(input: {
  workspaceId: string;
  userId: string;
  action: string;
  provider: CalendarProviderName;
  metadata?: Record<string, unknown>;
}) {
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "CalendarProvider",
    entityId: input.provider,
    action: input.action,
    metadata: {
      provider: input.provider,
      ...(input.metadata ?? {})
    }
  });
}

async function exchangeGoogleCode(code: string) {
  const config = getGoogleCalendarOAuthConfig();
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
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

async function exchangeMicrosoftCode(code: string) {
  const config = getMicrosoftCalendarOAuthConfig();
  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      scope: MICROSOFT_SCOPES.join(" ")
    })
  });
  if (!response.ok) throw new Error(`Microsoft token exchange failed: ${response.status}`);
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

async function refreshGoogleToken(refreshToken: string) {
  const config = getGoogleCalendarOAuthConfig();
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
  if (!response.ok) throw new Error(`Google token refresh failed: ${response.status}`);
  return response.json() as Promise<{ access_token: string; expires_in?: number; scope?: string }>;
}

async function refreshMicrosoftToken(refreshToken: string) {
  const config = getMicrosoftCalendarOAuthConfig();
  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      redirect_uri: config.redirectUri,
      grant_type: "refresh_token",
      scope: MICROSOFT_SCOPES.join(" ")
    })
  });
  if (!response.ok) throw new Error(`Microsoft token refresh failed: ${response.status}`);
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>;
}

export function getCalendarAuthorizationUrl(context: CalendarConnectionContext) {
  const provider = getCalendarProviderName();
  const state = encodeState(context);
  if (provider === "google") {
    const config = getGoogleCalendarOAuthConfig();
    if (!config.clientId || !config.redirectUri) return null;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_SCOPES.join(" "),
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (provider === "microsoft") {
    const config = getMicrosoftCalendarOAuthConfig();
    if (!config.clientId || !config.redirectUri) return null;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: MICROSOFT_SCOPES.join(" "),
      response_mode: "query",
      state
    });
    return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  return null;
}

export async function handleCalendarOAuthCallback(input: CalendarOAuthCallbackInput): Promise<CalendarProviderResult> {
  try {
    const provider = input.provider;
    const tokenResponse = provider === "google" ? await exchangeGoogleCode(input.code) : await exchangeMicrosoftCode(input.code);
    const expiresAt = tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : null;
    await upsertWorkspaceProviderConnection({
      workspaceId: input.workspaceId,
      key: "calendar",
      providerName: provider,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenExpiresAt: expiresAt,
      scopes: (tokenResponse.scope || "").split(/\s+/).filter(Boolean),
      lastSuccessfulActionAt: new Date(),
      lastErrorSummary: null,
      metadataJson: { selectedCalendarId: null }
    });
    await auditCalendarProviderAction({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider,
      action: "calendar.provider_connected"
    });
    return { ok: true, provider, lastSyncedAt: new Date().toISOString() };
  } catch (error) {
    const reason = sanitizeCalendarError(error);
    await auditCalendarProviderAction({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: input.provider,
      action: "calendar.appointment_sync_failed",
      metadata: { reason }
    });
    return { ok: false, provider: input.provider, reason };
  }
}

export async function refreshCalendarProviderTokens(context: CalendarConnectionContext): Promise<CalendarProviderResult> {
  const connection = await getWorkspaceProviderConnection(context.workspaceId, "calendar");
  const refreshToken = decryptStoredProviderToken(connection?.encryptedRefreshToken);
  if (!refreshToken) {
    return { ok: false, provider: context.provider, reason: "Refresh token unavailable." };
  }

  try {
    const tokenResponse = context.provider === "google"
      ? await refreshGoogleToken(refreshToken)
      : await refreshMicrosoftToken(refreshToken);
    const expiresAt = tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : null;
    await upsertWorkspaceProviderConnection({
      workspaceId: context.workspaceId,
      key: "calendar",
      providerName: context.provider,
      accessToken: tokenResponse.access_token,
      refreshToken: ("refresh_token" in tokenResponse ? (tokenResponse.refresh_token as string | undefined) : undefined) || refreshToken,
      tokenExpiresAt: expiresAt,
      scopes: (tokenResponse.scope || connection?.scopes?.join(" ") || "").split(/\s+/).filter(Boolean),
      connectedAccountLabel: connection?.connectedAccountLabel ?? null,
      metadataJson: connection?.metadataJson ?? null,
      lastSuccessfulActionAt: new Date(),
      lastErrorSummary: null
    });
    await auditCalendarProviderAction({
      workspaceId: context.workspaceId,
      userId: context.userId,
      provider: context.provider,
      action: "calendar.token_refreshed"
    });
    return { ok: true, provider: context.provider, lastSyncedAt: new Date().toISOString() };
  } catch (error) {
    const reason = sanitizeCalendarError(error);
    return { ok: false, provider: context.provider, reason };
  }
}

export async function disconnectCalendarProvider(context: CalendarConnectionContext): Promise<CalendarProviderResult> {
  await markWorkspaceProviderDisconnected({
    workspaceId: context.workspaceId,
    key: "calendar",
    providerName: context.provider,
    revokeTokens: true,
    lastErrorSummary: null
  });
  await auditCalendarProviderAction({
    workspaceId: context.workspaceId,
    userId: context.userId,
    provider: context.provider,
    action: "calendar.provider_disconnected"
  });
  await auditCalendarProviderAction({
    workspaceId: context.workspaceId,
    userId: context.userId,
    provider: context.provider,
    action: "calendar.token_revoked"
  });
  return { ok: true, provider: context.provider };
}
