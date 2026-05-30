import { prisma } from "@/lib/prisma";
import {
  getEmailSyncProviderEnv,
  getEmailSyncProviderName,
  getEmailSyncProviderStatus,
  type EmailMessageMetadata,
  type EmailSyncConnectionContext,
  type EmailSyncProviderAdapter,
  type EmailSyncProviderName,
  type EmailSyncProviderResult,
  type EmailSyncSendPayload,
  type EmailThreadMetadata
} from "@/lib/providers/email-sync-provider";
import {
  decodeEmailSyncOAuthState,
  disconnectEmailSyncProvider,
  getEmailSyncAuthorizationUrl,
  handleEmailSyncOAuthCallback,
  refreshEmailSyncToken
} from "@/lib/services/email-sync/email-sync-oauth";
import {
  buildDryRunThreadImport,
  buildEmailSyncTemplate,
  buildSecurePortalLoginLink,
  assertSafeEmailPayload
} from "@/lib/services/email-sync/email-sync-safety";
import {
  minimizeSubjectPreview,
  redactEmailSyncError,
  sanitizeMessageMetadata,
  sanitizeThreadMetadata
} from "@/lib/services/email-sync/email-sync-redaction";
import {
  decryptStoredProviderToken,
  getWorkspaceProviderConnection,
  recordWorkspaceProviderActivity
} from "@/lib/services/oauth-token-vault";
import { auditEvent } from "@/lib/services/audit";

type AuthorizedContext = EmailSyncConnectionContext & {
  accessToken: string | null;
};

async function auditEmailSyncAction(input: {
  workspaceId: string;
  userId: string;
  action: string;
  provider: EmailSyncProviderName;
  metadata?: Record<string, unknown>;
}) {
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "EmailSync",
    entityId: input.provider,
    action: input.action,
    metadata: {
      provider: input.provider,
      ...(input.metadata ?? {})
    }
  });
}

async function getAuthorizedContext(context: EmailSyncConnectionContext): Promise<AuthorizedContext> {
  const connection = await getWorkspaceProviderConnection(context.workspaceId, "email_sync");
  let accessToken = decryptStoredProviderToken(connection?.encryptedAccessToken);
  const expiresAt = connection?.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null;
  if (accessToken && expiresAt && expiresAt.getTime() <= Date.now() + 30_000) {
    const refreshed = await refreshEmailSyncToken(context);
    if (refreshed.ok) {
      const nextConnection = await getWorkspaceProviderConnection(context.workspaceId, "email_sync");
      accessToken = decryptStoredProviderToken(nextConnection?.encryptedAccessToken);
    }
  }
  return { ...context, accessToken };
}

async function gmailRequest<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`Gmail request failed: ${response.status}`);
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

async function microsoftRequest<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`Microsoft mail request failed: ${response.status}`);
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

function encodeGmailRawMessage(payload: EmailSyncSendPayload) {
  const message = [
    `To: ${payload.to}`,
    `Subject: ${payload.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    payload.bodyText
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

function extractHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

export async function getEmailSyncProviderAdapter(context: EmailSyncConnectionContext): Promise<EmailSyncProviderAdapter> {
  const listRecentThreads: EmailSyncProviderAdapter["listRecentThreads"] = async (requestContext) => {
    const authorized = await getAuthorizedContext(requestContext);
    const accessToken = authorized.accessToken;
    if (!accessToken) return [];

    try {
      if (authorized.provider === "gmail") {
        const response = await gmailRequest<{ threads?: Array<{ id: string }> }>(accessToken, "/threads?maxResults=8");
        const threads = await Promise.all(
          (response.threads ?? []).slice(0, 8).map(async (item) => {
            const detail = await gmailRequest<{
              id: string;
              messages?: Array<{
                id: string;
                internalDate?: string;
                payload?: { headers?: Array<{ name?: string; value?: string }> };
              }>;
            }>(accessToken, `/threads/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`);
            const latest = detail.messages?.[detail.messages.length - 1];
            return sanitizeThreadMetadata({
              externalThreadId: detail.id,
              externalMessageId: latest?.id,
              subject: extractHeader(latest?.payload?.headers, "Subject"),
              from: extractHeader(latest?.payload?.headers, "From"),
              to: extractHeader(latest?.payload?.headers, "To").split(","),
              lastMessageAt: latest?.internalDate ? new Date(Number(latest.internalDate)).toISOString() : null,
              messageCount: detail.messages?.length ?? 1
            });
          })
        );
        await auditEmailSyncAction({
          workspaceId: authorized.workspaceId,
          userId: authorized.userId,
          provider: authorized.provider,
          action: "email_sync.thread_listed",
          metadata: { threadCount: threads.length }
        });
        return threads;
      }

      const response = await microsoftRequest<{
        value?: Array<{
          id: string;
          conversationId?: string;
          subject?: string;
          from?: { emailAddress?: { address?: string } };
          toRecipients?: Array<{ emailAddress?: { address?: string } }>;
          receivedDateTime?: string;
        }>;
      }>(
        accessToken,
        "/me/messages?$top=8&$select=id,conversationId,subject,from,toRecipients,receivedDateTime"
      );
      const threads = (response.value ?? []).map((item) =>
        sanitizeThreadMetadata({
          externalThreadId: item.conversationId || item.id,
          externalMessageId: item.id,
          subject: item.subject,
          from: item.from?.emailAddress?.address,
          to: (item.toRecipients ?? []).map((recipient) => recipient.emailAddress?.address || ""),
          lastMessageAt: item.receivedDateTime ?? null,
          messageCount: 1
        })
      );
      await auditEmailSyncAction({
        workspaceId: authorized.workspaceId,
        userId: authorized.userId,
        provider: authorized.provider,
        action: "email_sync.thread_listed",
        metadata: { threadCount: threads.length }
      });
      return threads;
    } catch (error) {
      const reason = redactEmailSyncError(error instanceof Error ? error.message : String(error));
      await recordWorkspaceProviderActivity({
        workspaceId: authorized.workspaceId,
        key: "email_sync",
        providerName: authorized.provider,
        lastErrorSummary: reason,
        connectionState: "attention_required"
      });
      return [];
    }
  };

  const getThreadMetadata: EmailSyncProviderAdapter["getThreadMetadata"] = async (requestContext) => {
    const threads = await listRecentThreads(requestContext);
    return threads.find((item) => item.externalThreadId === requestContext.externalThreadId) ?? null;
  };

  const sendEmail: EmailSyncProviderAdapter["sendEmail"] = async (requestContext) => {
    const authorized = await getAuthorizedContext(requestContext);
    const accessToken = authorized.accessToken;
    if (!accessToken) {
      return { ok: false, provider: authorized.provider, reason: "Email sync provider not configured or connected." };
    }

    try {
      if (authorized.provider === "gmail") {
        await gmailRequest(accessToken, "/messages/send", {
          method: "POST",
          body: JSON.stringify({ raw: encodeGmailRawMessage(requestContext.payload) })
        });
      } else {
        await microsoftRequest(accessToken, "/me/sendMail", {
          method: "POST",
          body: JSON.stringify({
            message: {
              subject: requestContext.payload.subject,
              body: {
                contentType: "Text",
                content: requestContext.payload.bodyText
              },
              toRecipients: [{ emailAddress: { address: requestContext.payload.to } }]
            },
            saveToSentItems: true
          })
        });
      }

      await auditEmailSyncAction({
        workspaceId: authorized.workspaceId,
        userId: authorized.userId,
        provider: authorized.provider,
        action: "email_sync.email_sent",
        metadata: { to: requestContext.payload.to, templateKey: requestContext.payload.templateKey ?? null }
      });
      return { ok: true, provider: authorized.provider, lastSyncedAt: new Date().toISOString() };
    } catch (error) {
      const reason = redactEmailSyncError(error instanceof Error ? error.message : String(error));
      await auditEmailSyncAction({
        workspaceId: authorized.workspaceId,
        userId: authorized.userId,
        provider: authorized.provider,
        action: "email_sync.email_send_failed",
        metadata: { reason }
      });
      return { ok: false, provider: authorized.provider, reason };
    }
  };

  return {
    getProviderStatus: () => getEmailSyncProviderStatus(),
    getAuthorizationUrl: getEmailSyncAuthorizationUrl,
    handleOAuthCallback: handleEmailSyncOAuthCallback,
    refreshToken: refreshEmailSyncToken,
    disconnect: disconnectEmailSyncProvider,
    sendEmail,
    listRecentThreads,
    getThreadMetadata,
    async getThreadMessages(requestContext) {
      const authorized = await getAuthorizedContext(requestContext);
      const accessToken = authorized.accessToken;
      if (!accessToken) return [];

      try {
        if (authorized.provider === "gmail") {
          const detail = await gmailRequest<{
            messages?: Array<{
              id: string;
              labelIds?: string[];
              internalDate?: string;
              snippet?: string;
              payload?: { headers?: Array<{ name?: string; value?: string }> };
            }>;
          }>(accessToken, `/threads/${encodeURIComponent(requestContext.externalThreadId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`);

          return (detail.messages ?? []).map((message) =>
            sanitizeMessageMetadata({
              externalMessageId: message.id,
              direction: message.labelIds?.includes("SENT") ? "outbound" : "inbound",
              sender: extractHeader(message.payload?.headers, "From"),
              recipients: extractHeader(message.payload?.headers, "To").split(","),
              sentAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
              subject: extractHeader(message.payload?.headers, "Subject"),
              bodyPreview: message.snippet
            })
          );
        }

        const response = await microsoftRequest<{
          value?: Array<{
            id: string;
            conversationId?: string;
            subject?: string;
            from?: { emailAddress?: { address?: string } };
            toRecipients?: Array<{ emailAddress?: { address?: string } }>;
            sentDateTime?: string;
            bodyPreview?: string;
          }>;
        }>(
          accessToken,
          `/me/messages?$filter=conversationId eq '${requestContext.externalThreadId.replace(/'/g, "''")}'&$top=20&$select=id,conversationId,subject,from,toRecipients,sentDateTime,bodyPreview`
        );

        return (response.value ?? []).map((message) =>
          sanitizeMessageMetadata({
            externalMessageId: message.id,
            direction: "inbound",
            sender: message.from?.emailAddress?.address,
            recipients: (message.toRecipients ?? []).map((recipient) => recipient.emailAddress?.address || ""),
            sentAt: message.sentDateTime ?? null,
            subject: message.subject,
            bodyPreview: message.bodyPreview
          })
        );
      } catch (error) {
        const reason = redactEmailSyncError(error instanceof Error ? error.message : String(error));
        await auditEmailSyncAction({
          workspaceId: authorized.workspaceId,
          userId: authorized.userId,
          provider: authorized.provider,
          action: "email_sync.sync_failed",
          metadata: { reason }
        });
        return [];
      }
    },
    async linkThreadToMatter(requestContext) {
      return { ok: true, provider: requestContext.provider, externalThreadId: requestContext.thread.externalThreadId, lastSyncedAt: new Date().toISOString() };
    },
    async unlinkThreadFromMatter(requestContext) {
      return { ok: true, provider: requestContext.provider, externalThreadId: requestContext.externalThreadId, lastSyncedAt: new Date().toISOString() };
    },
    dryRunEmailPayload(payload) {
      return payload;
    },
    dryRunThreadImport(thread) {
      return buildDryRunThreadImport(thread);
    }
  };
}

export async function getEmailSyncIntegrationView(workspaceId: string, userId: string) {
  const provider = getEmailSyncProviderStatus();
  const env = getEmailSyncProviderEnv();
  const connection = await getWorkspaceProviderConnection(workspaceId, "email_sync");
  const context: EmailSyncConnectionContext = {
    workspaceId,
    userId,
    provider: getEmailSyncProviderName()
  };
  const recentAudit = await prisma.auditEvent.findMany({
    where: {
      workspaceId,
      action: {
        in: [
          "email_sync.provider_connected",
          "email_sync.provider_disconnected",
          "email_sync.connection_tested",
          "email_sync.token_refreshed",
          "email_sync.token_revoked",
          "email_sync.email_sent",
          "email_sync.email_send_failed",
          "email_sync.thread_listed",
          "email_sync.thread_linked_to_matter",
          "email_sync.thread_unlinked_from_matter",
          "email_sync.message_imported_to_matter",
          "email_sync.sync_failed"
        ]
      }
    },
    orderBy: { createdAt: "desc" },
    take: 12
  });

  const dryRunPreview = buildEmailSyncTemplate("document_request", {
    workspaceName: "Aria Migration Practice",
    recipientName: "Client",
    securePortalLink: buildSecurePortalLoginLink()
  });

  let recentThreads: EmailThreadMetadata[] = [];
  if (provider.configured && connection?.connected) {
    try {
      recentThreads = await (await getEmailSyncProviderAdapter(context)).listRecentThreads(context);
    } catch {
      recentThreads = [];
    }
  }

  return {
    provider,
    env,
    connection,
    recentAudit,
    authorizationUrl: provider.configured ? getEmailSyncAuthorizationUrl(context) : null,
    dryRunPreview,
    dryRunImportPreview: buildDryRunThreadImport(
      sanitizeThreadMetadata({
        externalThreadId: "demo-thread",
        subject: "Secure portal follow-up",
        from: "client@example.com",
        to: ["agent@example.com"],
        lastMessageAt: new Date().toISOString(),
        messageCount: 2
      })
    ),
    recentThreads
  };
}

export async function runEmailSyncConnectionTest(input: { workspaceId: string; userId: string }) {
  const provider = getEmailSyncProviderStatus();
  const context: EmailSyncConnectionContext = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    provider: getEmailSyncProviderName()
  };

  if (!provider.configured) {
    await auditEmailSyncAction({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: context.provider,
      action: "email_sync.connection_tested",
      metadata: { result: "not_configured" }
    });
    return { ok: true, result: "not_configured" as const, threads: [] as EmailThreadMetadata[] };
  }

  const threads = await (await getEmailSyncProviderAdapter(context)).listRecentThreads(context);
  await auditEmailSyncAction({
    workspaceId: input.workspaceId,
    userId: input.userId,
    provider: context.provider,
    action: "email_sync.connection_tested",
    metadata: { result: threads.length ? "connected" : "configured_without_threads", threadCount: threads.length }
  });
  return { ok: true, result: threads.length ? ("connected" as const) : ("configured_without_threads" as const), threads };
}

export async function resolveEmailSyncOAuthCallbackState(state: string | null | undefined) {
  return decodeEmailSyncOAuthState(state);
}
