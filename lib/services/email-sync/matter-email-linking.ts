import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessMatter, hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { auditEvent } from "@/lib/services/audit";
import {
  getEmailSyncProviderAdapter,
  getEmailSyncIntegrationView
} from "@/lib/services/email-sync/email-sync-integration";
import {
  assertSafeEmailPayload,
  buildEmailSyncTemplate,
  buildSecurePortalLoginLink,
  type EmailSyncTemplateInput,
  type EmailSyncTemplateKey
} from "@/lib/services/email-sync/email-sync-safety";
import {
  minimizeSubjectPreview,
  redactEmailSyncError,
  sanitizeMessageMetadata,
  sanitizeThreadMetadata
} from "@/lib/services/email-sync/email-sync-redaction";
import {
  getEmailSyncProviderName,
  getEmailSyncProviderStatus,
  type EmailSyncConnectionContext,
  type EmailMessageMetadata,
  type EmailSyncSendPayload,
  type EmailThreadMetadata
} from "@/lib/providers/email-sync-provider";
import { getWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { addMatterTimelineEvent } from "@/lib/services/client-workflows";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

async function getAccessibleMatter(workspaceId: string, matterId: string, user: ScopedUser) {
  const matter = await prisma.matter.findFirst({
    where: { id: matterId, ...(user ? scopedMatterWhere(user) : { workspaceId }) },
    include: { client: true, assignedToUser: true, workspace: true }
  });
  if (!matter || !canAccessMatter(user, matter)) return null;
  return matter;
}

async function auditMailboxAction(input: {
  workspaceId: string;
  userId: string;
  matterId?: string | null;
  action: string;
  metadata?: Prisma.InputJsonObject;
}) {
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "EmailSync",
    entityId: input.matterId ?? "email_sync",
    action: input.action,
    metadata: input.metadata
  });
}

export async function getMatterEmailWorkspace(input: {
  workspaceId: string;
  matterId: string;
  user: ScopedUser;
}) {
  const matter = await getAccessibleMatter(input.workspaceId, input.matterId, input.user);
  if (!matter) return null;

  const [linkedThreads, integrationView, connection] = await Promise.all([
    prisma.matterEmailThread.findMany({
      where: { workspaceId: input.workspaceId, matterId: input.matterId },
      include: {
        linkedByUser: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { sentAt: "desc" }, take: 5 }
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }]
    }),
    getEmailSyncIntegrationView(input.workspaceId, input.user.id),
    getWorkspaceProviderConnection(input.workspaceId, "email_sync")
  ]);

  const templateInput: EmailSyncTemplateInput = {
    workspaceName: matter.workspace?.name || "Aria Migration Practice",
    recipientName: `${matter.client.firstName} ${matter.client.lastName}`,
    securePortalLink: buildSecurePortalLoginLink()
  };

  return {
    matter,
    provider: integrationView.provider,
    providerEnv: integrationView.env,
    connection,
    recentThreads: integrationView.recentThreads,
    dryRunPreview: integrationView.dryRunPreview,
    templatePreviews: {
      document_request: buildEmailSyncTemplate("document_request", templateInput),
      confirmation_request: buildEmailSyncTemplate("confirmation_request", templateInput),
      appointment_reminder: buildEmailSyncTemplate("appointment_reminder", templateInput),
      portal_invite_reminder: buildEmailSyncTemplate("portal_invite_reminder", templateInput),
      general_follow_up: buildEmailSyncTemplate("general_follow_up", templateInput)
    },
    linkedThreads: linkedThreads.map((thread: typeof linkedThreads[number]) => ({
      id: thread.id,
      provider: thread.provider,
      externalThreadId: thread.externalThreadId,
      subjectPreview: thread.subjectPreview || "No subject",
      fromPreview: typeof thread.fromMetadataJson === "object" && thread.fromMetadataJson && "address" in (thread.fromMetadataJson as Record<string, unknown>)
        ? String((thread.fromMetadataJson as Record<string, unknown>).address)
        : "unknown@example.com",
      toPreview: Array.isArray(thread.toMetadataJson) ? (thread.toMetadataJson as string[]) : [],
      messageCount: thread.messageCount,
      lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
      linkedBy: thread.linkedByUser,
      syncStatus: thread.syncStatus,
      lastSyncAt: thread.lastSyncAt?.toISOString() ?? null,
      lastErrorSummary: thread.lastErrorSummary,
      bodyImportedAt: thread.bodyImportedAt?.toISOString() ?? null,
      messages: thread.messages.map((message: typeof thread.messages[number]) => ({
        id: message.id,
        direction: message.direction,
        senderLabel: message.senderLabel || "Unknown sender",
        recipientLabels: Array.isArray(message.recipientLabelsJson) ? (message.recipientLabelsJson as string[]) : [],
        sentAt: message.sentAt?.toISOString() ?? null,
        subjectPreview: message.subjectPreview || "No subject",
        bodyImported: message.bodyImported,
        bodyPreview: message.bodyPreview
      }))
    }))
  };
}

export async function linkMatterEmailThread(input: {
  workspaceId: string;
  matterId: string;
  user: ScopedUser;
  thread: EmailThreadMetadata;
}) {
  const matter = await getAccessibleMatter(input.workspaceId, input.matterId, input.user);
  if (!matter) {
    return { ok: false, reason: "Matter is not available for this user scope." };
  }

  const linked = await prisma.matterEmailThread.upsert({
    where: {
      workspaceId_matterId_externalThreadId: {
        workspaceId: input.workspaceId,
        matterId: input.matterId,
        externalThreadId: input.thread.externalThreadId
      }
    },
    create: {
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      linkedByUserId: input.user.id,
      provider: getEmailSyncProviderName(),
      externalThreadId: input.thread.externalThreadId,
      externalMessageId: input.thread.externalMessageId ?? null,
      subjectPreview: minimizeSubjectPreview(input.thread.subjectPreview),
      fromMetadataJson: { address: input.thread.fromPreview } as Prisma.InputJsonObject,
      toMetadataJson: input.thread.toPreview as Prisma.InputJsonArray,
      messageCount: input.thread.messageCount,
      lastMessageAt: input.thread.lastMessageAt ? new Date(input.thread.lastMessageAt) : null,
      syncStatus: "LINKED",
      lastSyncAt: new Date()
    },
    update: {
      linkedByUserId: input.user.id,
      provider: getEmailSyncProviderName(),
      externalMessageId: input.thread.externalMessageId ?? null,
      subjectPreview: minimizeSubjectPreview(input.thread.subjectPreview),
      fromMetadataJson: { address: input.thread.fromPreview } as Prisma.InputJsonObject,
      toMetadataJson: input.thread.toPreview as Prisma.InputJsonArray,
      messageCount: input.thread.messageCount,
      lastMessageAt: input.thread.lastMessageAt ? new Date(input.thread.lastMessageAt) : null,
      syncStatus: "LINKED",
      lastSyncAt: new Date(),
      lastErrorSummary: null
    }
  });

  await auditMailboxAction({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    matterId: input.matterId,
    action: "email_sync.thread_linked_to_matter",
    metadata: {
      provider: getEmailSyncProviderName(),
      externalThreadId: input.thread.externalThreadId,
      subjectPreview: linked.subjectPreview
    }
  });
  await addMatterTimelineEvent({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    actorUserId: input.user.id,
    eventType: "email_sync.thread_linked",
    title: "Email thread linked to matter",
    description: `A mailbox thread was linked for review-required matter communication metadata.`
  });

  return { ok: true, threadId: linked.id };
}

export async function unlinkMatterEmailThread(input: {
  workspaceId: string;
  matterId: string;
  user: ScopedUser;
  threadId: string;
}) {
  const matter = await getAccessibleMatter(input.workspaceId, input.matterId, input.user);
  if (!matter) return { ok: false, reason: "Matter is not available for this user scope." };

  const thread = await prisma.matterEmailThread.findFirst({
    where: { id: input.threadId, workspaceId: input.workspaceId, matterId: input.matterId }
  });
  if (!thread) return { ok: false, reason: "Linked thread not found." };

  await prisma.matterEmailThread.delete({ where: { id: thread.id } });
  await auditMailboxAction({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    matterId: input.matterId,
    action: "email_sync.thread_unlinked_from_matter",
    metadata: { externalThreadId: thread.externalThreadId }
  });
  return { ok: true };
}

export async function importMatterEmailThreadMessages(input: {
  workspaceId: string;
  matterId: string;
  user: ScopedUser;
  threadId: string;
}) {
  const matter = await getAccessibleMatter(input.workspaceId, input.matterId, input.user);
  if (!matter) return { ok: false, reason: "Matter is not available for this user scope." };

  const thread = await prisma.matterEmailThread.findFirst({
    where: { id: input.threadId, workspaceId: input.workspaceId, matterId: input.matterId }
  });
  if (!thread) return { ok: false, reason: "Linked thread not found." };

  const providerStatus = getEmailSyncProviderStatus();
  const context: EmailSyncConnectionContext = {
    workspaceId: input.workspaceId,
    userId: input.user.id,
    provider: getEmailSyncProviderName()
  };

  let messages: EmailMessageMetadata[] = [];
  if (providerStatus.configured) {
    messages = await (await getEmailSyncProviderAdapter(context)).getThreadMessages({
      ...context,
      externalThreadId: thread.externalThreadId
    });
  }
  if (!messages.length) {
    messages = [
      sanitizeMessageMetadata({
        externalMessageId: `${thread.externalThreadId}-import-preview`,
        direction: "inbound",
        sender: typeof thread.fromMetadataJson === "object" && thread.fromMetadataJson && "address" in (thread.fromMetadataJson as Record<string, unknown>)
          ? String((thread.fromMetadataJson as Record<string, unknown>).address)
          : "client@example.com",
        recipients: Array.isArray(thread.toMetadataJson) ? (thread.toMetadataJson as string[]) : [],
        sentAt: thread.lastMessageAt?.toISOString() ?? null,
        subject: thread.subjectPreview,
        bodyPreview: "Metadata-only preview. Full body import was requested and remains review-required.",
        bodyImported: true
      })
    ];
  }

  for (const message of messages) {
    await prisma.matterEmailMessage.upsert({
      where: {
        threadId_externalMessageId: {
          threadId: thread.id,
          externalMessageId: message.externalMessageId
        }
      },
      create: {
        workspaceId: input.workspaceId,
        matterId: input.matterId,
        threadId: thread.id,
        externalMessageId: message.externalMessageId,
        direction: message.direction,
        senderLabel: message.senderLabel,
        recipientLabelsJson: message.recipientLabels as Prisma.InputJsonArray,
        subjectPreview: message.subjectPreview,
        sentAt: message.sentAt ? new Date(message.sentAt) : null,
        bodyImported: true,
        bodyPreview: message.bodyPreview ?? null
      },
      update: {
        direction: message.direction,
        senderLabel: message.senderLabel,
        recipientLabelsJson: message.recipientLabels as Prisma.InputJsonArray,
        subjectPreview: message.subjectPreview,
        sentAt: message.sentAt ? new Date(message.sentAt) : null,
        bodyImported: true,
        bodyPreview: message.bodyPreview ?? null
      }
    });
  }

  await prisma.matterEmailThread.update({
    where: { id: thread.id },
    data: {
      bodyImportedAt: new Date(),
      bodyImportSummary: "Explicit metadata/body preview import recorded for review.",
      syncStatus: "CONTENT_IMPORTED",
      lastSyncAt: new Date(),
      messageCount: Math.max(thread.messageCount, messages.length)
    }
  });

  await auditMailboxAction({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    matterId: input.matterId,
    action: "email_sync.message_imported_to_matter",
    metadata: { externalThreadId: thread.externalThreadId, importedCount: messages.length }
  });
  return { ok: true, importedCount: messages.length };
}

export async function sendMatterClientEmail(input: {
  workspaceId: string;
  matterId: string;
  user: ScopedUser;
  template: EmailSyncTemplateKey;
  subject?: string | null;
  bodyText?: string | null;
  confirmSensitiveContent?: boolean;
  requestOrigin?: string | null;
}) {
  if (!hasPermission(input.user, "can_send_client_requests")) {
    return { ok: false, reason: "You do not have permission to send client emails." };
  }

  const matter = await getAccessibleMatter(input.workspaceId, input.matterId, input.user);
  if (!matter) return { ok: false, reason: "Matter is not available for this user scope." };
  if (!matter.client.email) return { ok: false, reason: "Client email is not recorded for this matter." };

  const templateInput: EmailSyncTemplateInput = {
    workspaceName: matter.workspace?.name || "Aria Migration Practice",
    recipientName: `${matter.client.firstName} ${matter.client.lastName}`,
    securePortalLink: buildSecurePortalLoginLink(input.requestOrigin)
  };
  const draft = buildEmailSyncTemplate(input.template, templateInput);
  const payload: EmailSyncSendPayload = {
    ...draft,
    to: matter.client.email,
    subject: input.subject?.trim() || draft.subject,
    bodyText: input.bodyText?.trim() || draft.bodyText
  };
  const safety = assertSafeEmailPayload(payload, Boolean(input.confirmSensitiveContent));
  if (!safety.safe) {
    return { ok: false, reason: "Sensitive email content warning.", warning: true, matches: safety.matches, payload };
  }

  const provider = getEmailSyncProviderStatus();
  const context: EmailSyncConnectionContext = {
    workspaceId: input.workspaceId,
    userId: input.user.id,
    provider: getEmailSyncProviderName()
  };

  if (!provider.configured) {
    await auditMailboxAction({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      matterId: input.matterId,
      action: "email_sync.email_send_failed",
      metadata: { reason: "provider_not_configured", subjectPreview: payload.subject }
    });
    return {
      ok: true,
      delivered: false,
      fallbackMode: "manual_copy" as const,
      payload
    };
  }

  const result = await (await getEmailSyncProviderAdapter(context)).sendEmail({
    ...context,
    payload
  });
  if (!result.ok) {
    await prisma.emailSyncEvent.create({
      data: {
        workspaceId: input.workspaceId,
        matterId: input.matterId,
        actorUserId: input.user.id,
        provider: getEmailSyncProviderName(),
        syncStatus: "FAILED",
        action: "email_sync.email_send_failed",
        lastErrorSummary: redactEmailSyncError(result.reason),
        payloadPreviewJson: { subjectPreview: minimizeSubjectPreview(payload.subject), to: payload.to } as Prisma.InputJsonObject
      }
    });
    return { ok: false, reason: result.reason || "Email send failed." };
  }

  await prisma.emailSyncEvent.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      actorUserId: input.user.id,
      provider: getEmailSyncProviderName(),
      syncStatus: "SENT",
      action: "email_sync.email_sent",
      lastSyncAt: new Date(),
      payloadPreviewJson: { subjectPreview: minimizeSubjectPreview(payload.subject), to: payload.to } as Prisma.InputJsonObject
    }
  });
  await addMatterTimelineEvent({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    actorUserId: input.user.id,
    eventType: "email_sync.email_sent",
    title: "Client email sent",
    description: `A privacy-safe client email was sent through the connected mailbox provider.`
  });
  return { ok: true, delivered: true, payload };
}
