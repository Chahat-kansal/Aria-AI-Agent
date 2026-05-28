import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptString, encryptString } from "@/lib/security/encryption";
import type { ProviderConnectionState, ProviderKey } from "@/lib/providers/types";
import { getOrCreateWorkspaceOperationalSettings } from "@/lib/services/workspace-operational-settings";

export type WorkspaceProviderConnection = {
  key: ProviderKey;
  providerName: string;
  connectionState: ProviderConnectionState;
  connected: boolean;
  connectedAt: string | null;
  disconnectedAt: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  connectedAccountLabel: string | null;
  lastSyncAt: string | null;
  lastSuccessfulActionAt: string | null;
  lastErrorSummary: string | null;
  encryptedAccessToken?: string | null;
  encryptedRefreshToken?: string | null;
};

type SerializedConnectionMap = Partial<Record<ProviderKey, WorkspaceProviderConnection>>;
type WorkspaceSettingsWithConnections = {
  integrationConnectionsJson?: Prisma.JsonValue | null;
};

function parseConnections(value: Prisma.JsonValue | null | undefined): SerializedConnectionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as SerializedConnectionMap;
}

function serializeConnection(input: WorkspaceProviderConnection) {
  return {
    ...input,
    scopes: Array.isArray(input.scopes) ? input.scopes : []
  } satisfies WorkspaceProviderConnection;
}

async function saveConnectionMap(workspaceId: string, connections: SerializedConnectionMap) {
  await getOrCreateWorkspaceOperationalSettings(workspaceId);
  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId },
    data: {
      integrationConnectionsJson: connections as Prisma.InputJsonObject
    } as Prisma.WorkspaceOperationalSettingsUpdateInput
  });
}

export async function getWorkspaceProviderConnections(workspaceId: string) {
  const settings = await getOrCreateWorkspaceOperationalSettings(workspaceId);
  return parseConnections((settings as WorkspaceSettingsWithConnections).integrationConnectionsJson);
}

export async function getWorkspaceProviderConnection(workspaceId: string, key: ProviderKey) {
  const connections = await getWorkspaceProviderConnections(workspaceId);
  return connections[key] ?? null;
}

export async function upsertWorkspaceProviderConnection(input: {
  workspaceId: string;
  key: ProviderKey;
  providerName: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  scopes?: string[];
  connectedAccountLabel?: string | null;
  lastSyncAt?: Date | null;
  lastSuccessfulActionAt?: Date | null;
  lastErrorSummary?: string | null;
}) {
  const connections = await getWorkspaceProviderConnections(input.workspaceId);
  const next: WorkspaceProviderConnection = serializeConnection({
    key: input.key,
    providerName: input.providerName,
    connectionState: "connected",
    connected: true,
    connectedAt: connections[input.key]?.connectedAt ?? new Date().toISOString(),
    disconnectedAt: null,
    tokenExpiresAt: input.tokenExpiresAt?.toISOString() ?? connections[input.key]?.tokenExpiresAt ?? null,
    scopes: input.scopes ?? connections[input.key]?.scopes ?? [],
    connectedAccountLabel: input.connectedAccountLabel ?? connections[input.key]?.connectedAccountLabel ?? null,
    lastSyncAt: input.lastSyncAt?.toISOString() ?? connections[input.key]?.lastSyncAt ?? null,
    lastSuccessfulActionAt: input.lastSuccessfulActionAt?.toISOString() ?? new Date().toISOString(),
    lastErrorSummary: input.lastErrorSummary ?? null,
    encryptedAccessToken: input.accessToken ? encryptString(input.accessToken) : connections[input.key]?.encryptedAccessToken ?? null,
    encryptedRefreshToken: input.refreshToken ? encryptString(input.refreshToken) : connections[input.key]?.encryptedRefreshToken ?? null
  });

  await saveConnectionMap(input.workspaceId, { ...connections, [input.key]: next });
  return next;
}

export async function markWorkspaceProviderDisconnected(input: {
  workspaceId: string;
  key: ProviderKey;
  providerName?: string;
  revokeTokens?: boolean;
  lastErrorSummary?: string | null;
}) {
  const connections = await getWorkspaceProviderConnections(input.workspaceId);
  const current = connections[input.key];
  const next: WorkspaceProviderConnection = serializeConnection({
    key: input.key,
    providerName: input.providerName ?? current?.providerName ?? "not configured",
    connectionState: "disconnected",
    connected: false,
    connectedAt: current?.connectedAt ?? null,
    disconnectedAt: new Date().toISOString(),
    tokenExpiresAt: current?.tokenExpiresAt ?? null,
    scopes: current?.scopes ?? [],
    connectedAccountLabel: current?.connectedAccountLabel ?? null,
    lastSyncAt: current?.lastSyncAt ?? null,
    lastSuccessfulActionAt: current?.lastSuccessfulActionAt ?? null,
    lastErrorSummary: input.lastErrorSummary ?? current?.lastErrorSummary ?? null,
    encryptedAccessToken: input.revokeTokens ? null : current?.encryptedAccessToken ?? null,
    encryptedRefreshToken: input.revokeTokens ? null : current?.encryptedRefreshToken ?? null
  });

  await saveConnectionMap(input.workspaceId, { ...connections, [input.key]: next });
  return next;
}

export async function recordWorkspaceProviderActivity(input: {
  workspaceId: string;
  key: ProviderKey;
  providerName?: string;
  lastSyncAt?: Date | null;
  lastSuccessfulActionAt?: Date | null;
  lastErrorSummary?: string | null;
  connectionState?: ProviderConnectionState;
}) {
  const connections = await getWorkspaceProviderConnections(input.workspaceId);
  const current = connections[input.key];
  if (!current) return null;

  const next: WorkspaceProviderConnection = serializeConnection({
    ...current,
    providerName: input.providerName ?? current.providerName,
    connectionState: input.connectionState ?? current.connectionState,
    connected: (input.connectionState ?? current.connectionState) === "connected",
    lastSyncAt: input.lastSyncAt?.toISOString() ?? current.lastSyncAt ?? null,
    lastSuccessfulActionAt: input.lastSuccessfulActionAt?.toISOString() ?? current.lastSuccessfulActionAt ?? null,
    lastErrorSummary: input.lastErrorSummary ?? current.lastErrorSummary ?? null
  });

  await saveConnectionMap(input.workspaceId, { ...connections, [input.key]: next });
  return next;
}

export function decryptStoredProviderToken(value?: string | null) {
  return value ? decryptString(value) : null;
}
