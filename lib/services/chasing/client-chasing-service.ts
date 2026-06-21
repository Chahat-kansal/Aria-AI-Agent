import { AppointmentStatus, ClientChaseStatus, DocumentRequestItemStatus, DocumentRequestStatus, InvoiceStatus, ReviewRequestStatus, SmsConsentStatus, UserStatus, type Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import {
  type ClientChaseChannel,
  type ClientChaseSourceType,
  type ClientChasingChannels,
  CLIENT_CHASE_SOURCE_LABELS,
  DEFAULT_CLIENT_CHASING_CHANNELS,
  channelLabel,
  getClientChasingSettingsView,
  isWithinClientChasingQuietHours
} from "@/lib/services/chasing/client-chasing-policy";
import { redactChasingMetadata, redactChasingPreview, redactChasingReason } from "@/lib/services/chasing/client-chasing-redaction";
import { buildClientChaseTemplates, type ClientChasePreview } from "@/lib/services/chasing/client-chasing-templates";
import { addMatterTimelineEvent } from "@/lib/services/client-workflows";
import { sendEmail } from "@/lib/services/email/send-email";
import { hasPermission, scopedMatterWhere, type PermissionKey } from "@/lib/services/roles";
import { resolveBaseUrl } from "@/lib/services/runtime-config";
import { sendPush } from "@/lib/services/push/send-push";
import { sendSms } from "@/lib/services/sms/send-sms";

const prismaAny = prisma as any;

export type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson" | "email" | "name">;

export type PendingClientChase = {
  sourceId: string;
  sourceType: ClientChaseSourceType;
  label: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhoneLast4: string | null;
  matterId: string | null;
  matterReference: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  dueAt: string | null;
  lastAttemptAt: string | null;
  lastStatus: string | null;
  recommendedChannels: ClientChaseChannel[];
  blockedReasons: string[];
};

export type ClientChaseHistoryItem = {
  id: string;
  sourceType: string;
  channel: string;
  status: string;
  mode: string;
  createdAt: string;
  processedAt: string | null;
  blockedReason: string | null;
  clientName: string;
  matterReference: string | null;
  preview: { subject?: string | null; body: string; route?: string | null } | null;
};

export type ClientChasingDashboard = {
  settings: Awaited<ReturnType<typeof getClientChasingSettingsView>>;
  pending: PendingClientChase[];
  history: ClientChaseHistoryItem[];
  audit: Array<{ id: string; action: string; createdAt: Date; metadata: Record<string, unknown> }>;
  preferences: Array<{
    clientId: string;
    clientName: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    portalEnabled: boolean;
    optedOutNonEssential: boolean;
  }>;
};

type CandidateRecord = {
  sourceId: string;
  sourceType: ClientChaseSourceType;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  matterId: string | null;
  matterReference: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  dueAt: Date | null;
};

function requireChasingPermission(user: ScopedUser, permission: PermissionKey = "can_send_client_requests") {
  if (user.status === UserStatus.DISABLED || !hasPermission(user, permission)) {
    throw new Error("CLIENT_CHASING_DENIED");
  }
}

function portalLoginUrl(requestOrigin?: string | null) {
  const base = resolveBaseUrl({ requestOrigin });
  return base ? `${base}/client/portal` : "/client/portal";
}

async function getClientPreference(workspaceId: string, clientId: string) {
  return prismaAny.clientChasingPreference.findUnique({
    where: { workspaceId_clientId: { workspaceId, clientId } }
  });
}

function preferenceAllowsChannel(preference: any, channel: ClientChaseChannel) {
  if (!preference) return false;
  if (preference.optedOutNonEssential) return false;
  if (channel === "email") return Boolean(preference.emailEnabled);
  if (channel === "sms") return Boolean(preference.smsEnabled);
  if (channel === "push") return Boolean(preference.pushEnabled);
  return Boolean(preference.portalEnabled);
}

async function getLastAttempt(workspaceId: string, clientId: string, sourceType: ClientChaseSourceType) {
  return prismaAny.clientChaseAttempt.findFirst({
    where: { workspaceId, clientId, sourceType },
    orderBy: { createdAt: "desc" }
  });
}

async function getRecentSentAttempt(input: {
  workspaceId: string;
  clientId: string;
  sourceType: ClientChaseSourceType;
  channel: ClientChaseChannel;
  withinHours: number;
}) {
  const threshold = new Date(Date.now() - input.withinHours * 60 * 60 * 1000);
  return prismaAny.clientChaseAttempt.findFirst({
    where: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      sourceType: input.sourceType,
      channel: input.channel,
      status: ClientChaseStatus.SENT,
      createdAt: { gte: threshold }
    },
    orderBy: { createdAt: "desc" }
  });
}

async function recordClientChaseAttempt(input: {
  workspaceId: string;
  clientId: string;
  matterId?: string | null;
  actorUserId?: string | null;
  sourceType: ClientChaseSourceType;
  templateKey: string;
  channel: ClientChaseChannel;
  mode: "manual" | "automated";
  status: ClientChaseStatus;
  preview: { subject?: string | null; body: string; route?: string | null };
  metadata?: Record<string, unknown>;
  blockedReason?: string | null;
}) {
  return prismaAny.clientChaseAttempt.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      matterId: input.matterId || null,
      actorUserId: input.actorUserId || null,
      sourceType: input.sourceType,
      templateKey: input.templateKey,
      channel: input.channel,
      mode: input.mode,
      status: input.status,
      previewJson: redactChasingPreview(input.preview),
      metadataJson: redactChasingMetadata(input.metadata || {}),
      blockedReason: redactChasingReason(input.blockedReason),
      processedAt: input.status === ClientChaseStatus.PREVIEWED || input.status === ClientChaseStatus.PENDING ? null : new Date()
    }
  });
}

async function recordChasingAudit(input: {
  workspaceId: string;
  userId?: string;
  clientId: string;
  matterId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "ClientChaseAttempt",
    entityId: input.clientId,
    action: input.action,
    metadata: {
      clientId: input.clientId,
      matterId: input.matterId || null,
      ...(input.metadata || {})
    } as Prisma.InputJsonObject
  });
}

async function buildBlockedReasons(input: {
  workspaceId: string;
  clientId: string;
  sourceType: ClientChaseSourceType;
  channels: ClientChasingChannels;
  consentRequired: boolean;
}) {
  const reasons: string[] = [];
  const preference = await getClientPreference(input.workspaceId, input.clientId);
  if (input.consentRequired && !preference) {
    reasons.push("Consent/preferences not recorded.");
    return reasons;
  }
  if (preference?.optedOutNonEssential) reasons.push("Client opted out of non-essential chasing.");
  (Object.keys(input.channels) as ClientChaseChannel[]).forEach((channel) => {
    if (!input.channels[channel]) return;
    if (input.consentRequired && !preferenceAllowsChannel(preference, channel)) {
      reasons.push(`${channelLabel(channel)} preference not enabled.`);
    }
  });
  return Array.from(new Set(reasons));
}

async function listPendingDocumentChases(workspaceId: string, user: ScopedUser): Promise<CandidateRecord[]> {
  const requests = await prisma.documentRequest.findMany({
    where: {
      workspaceId,
      revokedAt: null,
      status: { in: [DocumentRequestStatus.SENT, DocumentRequestStatus.VIEWED, DocumentRequestStatus.OVERDUE] },
      matter: scopedMatterWhere(user),
      items: { some: { status: { in: [DocumentRequestItemStatus.MISSING, DocumentRequestItemStatus.REQUESTED] } } }
    },
    include: {
      client: true,
      matter: { include: { assignedToUser: true } }
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 40
  });

  return requests.map((request: any) => ({
    sourceId: request.id,
    sourceType: "missing_documents",
    clientId: request.clientId,
    clientName: `${request.client.firstName} ${request.client.lastName}`.trim(),
    clientEmail: request.client.email || request.recipientEmail || null,
    clientPhone: request.client.phone || null,
    matterId: request.matterId,
    matterReference: request.matter?.matterReference || null,
    assignedToUserId: request.matter?.assignedToUserId || null,
    assignedToUserName: request.matter?.assignedToUser?.name || null,
    dueAt: request.dueDate || null
  }));
}

async function listPendingConfirmationChases(workspaceId: string, user: ScopedUser): Promise<CandidateRecord[]> {
  const requests = await prisma.matterReviewRequest.findMany({
    where: {
      status: {
        in: [
          ReviewRequestStatus.REVIEW_REQUESTED,
          ReviewRequestStatus.SENT_TO_CLIENT,
          ReviewRequestStatus.VIEWED_BY_CLIENT,
          ReviewRequestStatus.REQUIRES_FOLLOW_UP
        ]
      },
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      matter: scopedMatterWhere(user)
    },
    include: {
      matter: { include: { client: true, assignedToUser: true } }
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
    take: 40
  });

  return requests.map((request: any) => ({
    sourceId: request.id,
    sourceType: "pending_confirmation",
    clientId: request.matter.clientId,
    clientName: `${request.matter.client.firstName} ${request.matter.client.lastName}`.trim(),
    clientEmail: request.recipientEmail || request.matter.client.email || null,
    clientPhone: request.matter.client.phone || null,
    matterId: request.matterId,
    matterReference: request.matter?.matterReference || null,
    assignedToUserId: request.matter?.assignedToUserId || null,
    assignedToUserName: request.matter?.assignedToUser?.name || null,
    dueAt: request.expiresAt || null
  }));
}

async function listAppointmentChases(workspaceId: string, user: ScopedUser): Promise<CandidateRecord[]> {
  const soon = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: { gte: new Date(), lte: soon },
      matter: scopedMatterWhere(user)
    },
    include: {
      client: true,
      matter: { include: { assignedToUser: true } }
    },
    orderBy: { startsAt: "asc" },
    take: 30
  });

  return appointments
    .filter((appointment: any) => appointment.clientId && appointment.client)
    .map((appointment: any) => ({
      sourceId: appointment.id,
      sourceType: "appointment",
      clientId: appointment.clientId,
      clientName: `${appointment.client.firstName} ${appointment.client.lastName}`.trim(),
      clientEmail: appointment.client.email || appointment.requestedByEmail || null,
      clientPhone: appointment.client.phone || null,
      matterId: appointment.matterId || null,
      matterReference: appointment.matter?.matterReference || null,
      assignedToUserId: appointment.assignedToUserId || appointment.matter?.assignedToUserId || null,
      assignedToUserName: appointment.assignedToUser?.name || appointment.matter?.assignedToUser?.name || null,
      dueAt: appointment.startsAt
    }));
}

async function listInvoiceChases(workspaceId: string, user: ScopedUser): Promise<CandidateRecord[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      workspaceId,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
      OR: [{ matter: scopedMatterWhere(user) }, { matterId: null, client: { workspaceId } }]
    },
    include: {
      client: true,
      matter: { include: { assignedToUser: true } }
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 40
  });

  return invoices
    .filter((invoice: any) => invoice.clientId && invoice.client)
    .map((invoice: any) => ({
      sourceId: invoice.id,
      sourceType: "unpaid_invoice",
      clientId: invoice.clientId,
      clientName: `${invoice.client.firstName} ${invoice.client.lastName}`.trim(),
      clientEmail: invoice.clientEmail || invoice.client.email || null,
      clientPhone: invoice.client.phone || null,
      matterId: invoice.matterId || null,
      matterReference: invoice.matter?.matterReference || null,
      assignedToUserId: invoice.matter?.assignedToUserId || invoice.client.assignedToUserId || null,
      assignedToUserName: invoice.matter?.assignedToUser?.name || invoice.client.assignedToUser?.name || null,
      dueAt: invoice.dueDate
    }));
}

async function listUnreadPortalMessageChases(workspaceId: string, user: ScopedUser): Promise<CandidateRecord[]> {
  const events = await prisma.matterTimelineEvent.findMany({
    where: {
      workspaceId,
      eventType: { in: ["portal.team_message", "portal.reminder_posted"] },
      matter: scopedMatterWhere(user)
    },
    include: {
      matter: { include: { client: true, assignedToUser: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 40
  });

  const seen = new Set<string>();
  const results: CandidateRecord[] = [];
  for (const event of events as any[]) {
    if (!event.matter?.clientId) continue;
    const key = `${event.matterId}:${event.clientId ?? event.matter.clientId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      sourceId: event.id,
      sourceType: "unread_portal_message",
      clientId: event.matter.clientId,
      clientName: `${event.matter.client.firstName} ${event.matter.client.lastName}`.trim(),
      clientEmail: event.matter.client.email || null,
      clientPhone: event.matter.client.phone || null,
      matterId: event.matterId,
      matterReference: event.matter.matterReference || null,
      assignedToUserId: event.matter.assignedToUserId || null,
      assignedToUserName: event.matter.assignedToUser?.name || null,
      dueAt: event.createdAt
    });
  }
  return results;
}

async function buildPendingItems(workspaceId: string, user: ScopedUser) {
  const settings = await getClientChasingSettingsView(workspaceId);
  const [documents, confirmations, appointments, invoices, messages] = await Promise.all([
    listPendingDocumentChases(workspaceId, user),
    listPendingConfirmationChases(workspaceId, user),
    listAppointmentChases(workspaceId, user),
    listInvoiceChases(workspaceId, user),
    listUnreadPortalMessageChases(workspaceId, user)
  ]);

  const candidates = [...documents, ...confirmations, ...appointments, ...invoices, ...messages];
  const pending = await Promise.all(candidates.map(async (candidate) => {
    const [preference, lastAttempt, blockedReasons] = await Promise.all([
      getClientPreference(workspaceId, candidate.clientId),
      getLastAttempt(workspaceId, candidate.clientId, candidate.sourceType),
      buildBlockedReasons({
        workspaceId,
        clientId: candidate.clientId,
        sourceType: candidate.sourceType,
        channels: settings.channels,
        consentRequired: settings.consentRequired
      })
    ]);

    const recommendedChannels = (Object.keys(settings.channels) as ClientChaseChannel[])
      .filter((channel) => settings.channels[channel] && (!settings.consentRequired || preferenceAllowsChannel(preference, channel)));

    return {
      sourceId: candidate.sourceId,
      sourceType: candidate.sourceType,
      label: CLIENT_CHASE_SOURCE_LABELS[candidate.sourceType],
      clientId: candidate.clientId,
      clientName: candidate.clientName,
      clientEmail: candidate.clientEmail,
      clientPhoneLast4: candidate.clientPhone ? candidate.clientPhone.slice(-4) : null,
      matterId: candidate.matterId,
      matterReference: candidate.matterReference,
      assignedToUserId: candidate.assignedToUserId,
      assignedToUserName: candidate.assignedToUserName,
      dueAt: candidate.dueAt ? candidate.dueAt.toISOString() : null,
      lastAttemptAt: lastAttempt?.createdAt ? new Date(lastAttempt.createdAt).toISOString() : null,
      lastStatus: lastAttempt?.status || null,
      recommendedChannels,
      blockedReasons
    } satisfies PendingClientChase;
  }));

  pending.sort((a, b) => {
    const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
  return { settings, pending };
}

export async function saveClientChasingSettings(input: {
  workspaceId: string;
  user: ScopedUser;
  enabled: boolean;
  autoSendEnabled: boolean;
  consentRequired: boolean;
  frequencyHours: number;
  channels: Partial<ClientChasingChannels>;
  quietHours?: { enabled: boolean; start: string | null; end: string | null; timezone: string | null };
}) {
  requireChasingPermission(input.user);
  const settings = await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: input.workspaceId },
    update: {
      clientChasingEnabled: input.enabled,
      clientChasingAutoSendEnabled: input.autoSendEnabled,
      clientChasingConsentRequired: input.consentRequired,
      clientChasingFrequencyHours: Math.min(168, Math.max(1, Math.round(input.frequencyHours || 48))),
      clientChasingChannelsJson: { ...DEFAULT_CLIENT_CHASING_CHANNELS, ...(input.channels || {}) },
      clientChasingQuietHoursJson: input.quietHours || { enabled: false, start: null, end: null, timezone: null }
    },
    create: {
      workspaceId: input.workspaceId,
      clientChasingEnabled: input.enabled,
      clientChasingAutoSendEnabled: input.autoSendEnabled,
      clientChasingConsentRequired: input.consentRequired,
      clientChasingFrequencyHours: Math.min(168, Math.max(1, Math.round(input.frequencyHours || 48))),
      clientChasingChannelsJson: { ...DEFAULT_CLIENT_CHASING_CHANNELS, ...(input.channels || {}) },
      clientChasingQuietHoursJson: input.quietHours || { enabled: false, start: null, end: null, timezone: null }
    }
  });

  await recordChasingAudit({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    clientId: "workspace",
    action: "client_chasing.settings_updated",
    metadata: {
      enabled: settings.clientChasingEnabled,
      autoSendEnabled: settings.clientChasingAutoSendEnabled,
      frequencyHours: settings.clientChasingFrequencyHours
    }
  });

  return settings;
}

export async function upsertClientChasingPreference(input: {
  workspaceId: string;
  user: ScopedUser;
  clientId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  portalEnabled: boolean;
  optedOutNonEssential: boolean;
  source?: string;
}) {
  requireChasingPermission(input.user);
  const preference = await prismaAny.clientChasingPreference.upsert({
    where: { workspaceId_clientId: { workspaceId: input.workspaceId, clientId: input.clientId } },
    update: {
      emailEnabled: input.emailEnabled,
      smsEnabled: input.smsEnabled,
      pushEnabled: input.pushEnabled,
      portalEnabled: input.portalEnabled,
      optedOutNonEssential: input.optedOutNonEssential,
      source: input.source || "workspace_chasing_panel",
      recordedByUserId: input.user.id
    },
    create: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      emailEnabled: input.emailEnabled,
      smsEnabled: input.smsEnabled,
      pushEnabled: input.pushEnabled,
      portalEnabled: input.portalEnabled,
      optedOutNonEssential: input.optedOutNonEssential,
      source: input.source || "workspace_chasing_panel",
      recordedByUserId: input.user.id
    }
  });

  await recordChasingAudit({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    clientId: input.clientId,
    action: input.optedOutNonEssential ? "client_chasing.opted_out" : "client_chasing.preference_recorded",
    metadata: {
      emailEnabled: input.emailEnabled,
      smsEnabled: input.smsEnabled,
      pushEnabled: input.pushEnabled,
      portalEnabled: input.portalEnabled,
      optedOutNonEssential: input.optedOutNonEssential
    }
  });

  return preference;
}

async function resolveCandidate(input: {
  workspaceId: string;
  user: ScopedUser;
  sourceType: ClientChaseSourceType;
  sourceId: string;
}) {
  const { pending } = await buildPendingItems(input.workspaceId, input.user);
  return pending.find((item) => item.sourceType === input.sourceType && item.sourceId === input.sourceId) || null;
}

async function buildPreviewForCandidate(input: {
  workspaceId: string;
  user: ScopedUser;
  sourceType: ClientChaseSourceType;
  sourceId: string;
  channel: ClientChaseChannel;
  requestOrigin?: string | null;
}) {
  const candidate = await resolveCandidate(input);
  if (!candidate) throw new Error("CLIENT_CHASE_NOT_FOUND");
  const clientContact = await prisma.client.findUnique({
    where: { id: candidate.clientId },
    select: { email: true, phone: true }
  });
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true }
  });
  const templates = buildClientChaseTemplates({
    sourceType: candidate.sourceType,
    workspaceName: workspace?.name || "Aria",
    portalUrl: portalLoginUrl(input.requestOrigin)
  });
  return {
    candidate: {
      ...candidate,
      clientEmail: candidate.clientEmail ?? clientContact?.email ?? null,
      clientPhone: clientContact?.phone ?? null
    },
    preview: templates[input.channel]
  };
}

async function findClientPushTargetUserId(workspaceId: string, clientId: string) {
  const subscription = await prisma.pushSubscription.findFirst({
    where: {
      workspaceId,
      clientId,
      consentStatus: { not: "OPTED_OUT" as any }
    },
    orderBy: { createdAt: "desc" }
  });
  return subscription?.userId || null;
}

export async function previewClientChase(input: {
  workspaceId: string;
  user: ScopedUser;
  sourceType: ClientChaseSourceType;
  sourceId: string;
  channel: ClientChaseChannel;
  requestOrigin?: string | null;
}) {
  requireChasingPermission(input.user);
  const { candidate, preview } = await buildPreviewForCandidate(input);
  await recordClientChaseAttempt({
    workspaceId: input.workspaceId,
    clientId: candidate.clientId,
    matterId: candidate.matterId,
    actorUserId: input.user.id,
    sourceType: candidate.sourceType,
    templateKey: preview.label,
    channel: input.channel,
    mode: "manual",
    status: ClientChaseStatus.PREVIEWED,
    preview,
    metadata: { sourceId: candidate.sourceId }
  });
  await recordChasingAudit({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    clientId: candidate.clientId,
    matterId: candidate.matterId,
    action: "client_chasing.previewed",
    metadata: { sourceType: candidate.sourceType, sourceId: candidate.sourceId, channel: input.channel }
  });

  return {
    candidate,
    preview
  };
}

async function sendPortalReminder(input: {
  workspaceId: string;
  userId: string;
  matterId: string | null;
  sourceType: ClientChaseSourceType;
  preview: ClientChasePreview;
}) {
  if (!input.matterId) {
    return { delivered: false, reason: "No matter is linked to this reminder source." };
  }
  await addMatterTimelineEvent({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    actorUserId: input.userId,
    eventType: "portal.reminder_posted",
    title: "Reminder from migration team",
    description: input.preview.body
  });
  return { delivered: true, reason: "Portal reminder posted." };
}

export async function sendClientChase(input: {
  workspaceId: string;
  user: ScopedUser;
  sourceType: ClientChaseSourceType;
  sourceId: string;
  channel: ClientChaseChannel;
  mode?: "manual" | "automated";
  requestOrigin?: string | null;
}) {
  requireChasingPermission(input.user);
  const mode = input.mode || "manual";
  const { settings } = await buildPendingItems(input.workspaceId, input.user);
  const { candidate, preview } = await buildPreviewForCandidate(input);
  const preference = await getClientPreference(input.workspaceId, candidate.clientId);

  if (!settings.enabled) {
    await recordClientChaseAttempt({
      workspaceId: input.workspaceId,
      clientId: candidate.clientId,
      matterId: candidate.matterId,
      actorUserId: input.user.id,
      sourceType: candidate.sourceType,
      templateKey: preview.label,
      channel: input.channel,
      mode,
      status: ClientChaseStatus.BLOCKED,
      preview,
      blockedReason: "workspace_disabled"
    });
    return { delivered: false, status: ClientChaseStatus.BLOCKED, reason: "Client chasing is disabled for this workspace." };
  }

  if (mode === "automated" && !settings.autoSendEnabled) {
    await recordClientChaseAttempt({
      workspaceId: input.workspaceId,
      clientId: candidate.clientId,
      matterId: candidate.matterId,
      actorUserId: input.user.id,
      sourceType: candidate.sourceType,
      templateKey: preview.label,
      channel: input.channel,
      mode,
      status: ClientChaseStatus.SKIPPED,
      preview,
      blockedReason: "auto_send_disabled"
    });
    return { delivered: false, status: ClientChaseStatus.SKIPPED, reason: "Auto-send is disabled by default." };
  }

  if (settings.consentRequired && (!preference || !preferenceAllowsChannel(preference, input.channel))) {
    const reason = preference?.optedOutNonEssential ? "client_opted_out" : "consent_missing";
    await recordClientChaseAttempt({
      workspaceId: input.workspaceId,
      clientId: candidate.clientId,
      matterId: candidate.matterId,
      actorUserId: input.user.id,
      sourceType: candidate.sourceType,
      templateKey: preview.label,
      channel: input.channel,
      mode,
      status: ClientChaseStatus.BLOCKED,
      preview,
      blockedReason: reason
    });
    await recordChasingAudit({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      clientId: candidate.clientId,
      matterId: candidate.matterId,
      action: reason === "client_opted_out" ? "client_chasing.blocked_opt_out" : "client_chasing.blocked_no_consent",
      metadata: { sourceType: candidate.sourceType, channel: input.channel }
    });
    return { delivered: false, status: ClientChaseStatus.BLOCKED, reason: reason === "client_opted_out" ? "Opt-out blocks non-essential chasing." : "Consent/preferences not recorded." };
  }

  if (isWithinClientChasingQuietHours({ quietHours: settings.quietHours, timezone: settings.timezone })) {
    await recordClientChaseAttempt({
      workspaceId: input.workspaceId,
      clientId: candidate.clientId,
      matterId: candidate.matterId,
      actorUserId: input.user.id,
      sourceType: candidate.sourceType,
      templateKey: preview.label,
      channel: input.channel,
      mode,
      status: ClientChaseStatus.BLOCKED,
      preview,
      blockedReason: "quiet_hours"
    });
    return { delivered: false, status: ClientChaseStatus.BLOCKED, reason: "Quiet hours block reminder sending right now." };
  }

  const recent = await getRecentSentAttempt({
    workspaceId: input.workspaceId,
    clientId: candidate.clientId,
    sourceType: candidate.sourceType,
    channel: input.channel,
    withinHours: settings.frequencyHours
  });
  if (recent) {
    await recordClientChaseAttempt({
      workspaceId: input.workspaceId,
      clientId: candidate.clientId,
      matterId: candidate.matterId,
      actorUserId: input.user.id,
      sourceType: candidate.sourceType,
      templateKey: preview.label,
      channel: input.channel,
      mode,
      status: ClientChaseStatus.RATE_LIMITED,
      preview,
      blockedReason: "rate_limited"
    });
    await recordChasingAudit({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      clientId: candidate.clientId,
      matterId: candidate.matterId,
      action: "client_chasing.rate_limited",
      metadata: { sourceType: candidate.sourceType, channel: input.channel, withinHours: settings.frequencyHours }
    });
    return { delivered: false, status: ClientChaseStatus.RATE_LIMITED, reason: "Reminder is temporarily rate limited." };
  }

  let delivered = false;
  let reason = "Reminder queued.";
  if (input.channel === "portal") {
    const result = await sendPortalReminder({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      matterId: candidate.matterId,
      sourceType: candidate.sourceType,
      preview
    });
    delivered = result.delivered;
    reason = result.reason;
  } else if (input.channel === "email") {
    if (!candidate.clientEmail) {
      reason = "No client email is stored for this reminder.";
    } else {
      const workspace = await prisma.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { name: true }
      });
      const result = await sendEmail({
        to: candidate.clientEmail,
        template: preview.emailTemplate || "document_request",
        templateInput: {
          recipientName: candidate.clientName,
          workspaceName: workspace?.name || "Aria",
          secureLink: portalLoginUrl(input.requestOrigin),
          intro: preview.body,
          actionLabel: "Open secure portal"
        },
        workspaceId: input.workspaceId,
        userId: input.user.id,
        metadata: { sourceType: candidate.sourceType, channel: input.channel }
      });
      delivered = result.delivered;
      reason = result.reason;
    }
  } else if (input.channel === "sms") {
    if (!candidate.clientPhone) {
      reason = "No client mobile number is stored for this reminder.";
    } else {
      const result = await sendSms({
        to: candidate.clientPhone,
        workspaceId: input.workspaceId,
        userId: input.user.id,
        clientId: candidate.clientId,
        matterId: candidate.matterId,
        body: preview.body
      });
      delivered = result.delivered;
      reason = result.reason;
    }
  } else if (input.channel === "push") {
    const pushUserId = await findClientPushTargetUserId(input.workspaceId, candidate.clientId);
    if (!pushUserId) {
      reason = "Client push is not configured for this client.";
    } else {
      const result = await sendPush({
        workspaceId: input.workspaceId,
        userId: pushUserId,
        clientId: candidate.clientId,
        matterId: candidate.matterId,
        title: preview.subject || "Aria",
        body: preview.body,
        route: "/client/portal"
      });
      delivered = result.delivered;
      reason = result.reason;
    }
  }

  const status = delivered ? ClientChaseStatus.SENT : ClientChaseStatus.BLOCKED;
  const attempt = await recordClientChaseAttempt({
    workspaceId: input.workspaceId,
    clientId: candidate.clientId,
    matterId: candidate.matterId,
    actorUserId: input.user.id,
    sourceType: candidate.sourceType,
    templateKey: preview.label,
    channel: input.channel,
    mode,
    status,
    preview,
    metadata: { sourceId: candidate.sourceId },
    blockedReason: delivered ? null : reason
  });

  await recordChasingAudit({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    clientId: candidate.clientId,
    matterId: candidate.matterId,
    action: delivered ? "client_chasing.sent" : "client_chasing.blocked",
    metadata: {
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      channel: input.channel,
      status,
      reason
    }
  });

  return { delivered, status, reason, attemptId: attempt.id };
}

export async function runClientChasingScheduler(input: {
  workspaceId: string;
  user: ScopedUser;
  requestOrigin?: string | null;
}) {
  requireChasingPermission(input.user);
  const { settings, pending } = await buildPendingItems(input.workspaceId, input.user);
  const eligible = pending.filter((item) => item.recommendedChannels.length > 0 && item.blockedReasons.length === 0);

  if (!settings.enabled || !settings.autoSendEnabled) {
    await recordChasingAudit({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      clientId: "workspace",
      action: "client_chasing.schedule_checked",
      metadata: {
        enabled: settings.enabled,
        autoSendEnabled: settings.autoSendEnabled,
        pendingCount: pending.length,
        eligibleCount: eligible.length
      }
    });
    return { sent: 0, pending: pending.length, eligible: eligible.length, autoSendEnabled: settings.autoSendEnabled };
  }

  let sent = 0;
  for (const item of eligible.slice(0, 10)) {
    const channel = item.recommendedChannels[0];
    const result = await sendClientChase({
      workspaceId: input.workspaceId,
      user: input.user,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      channel,
      mode: "automated",
      requestOrigin: input.requestOrigin
    });
    if (result.delivered) sent += 1;
  }

  await recordChasingAudit({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    clientId: "workspace",
    action: "client_chasing.schedule_checked",
    metadata: {
      enabled: settings.enabled,
      autoSendEnabled: settings.autoSendEnabled,
      pendingCount: pending.length,
      eligibleCount: eligible.length,
      sent
    }
  });
  return { sent, pending: pending.length, eligible: eligible.length, autoSendEnabled: settings.autoSendEnabled };
}

export async function getClientChasingDashboard(workspaceId: string, user: ScopedUser): Promise<ClientChasingDashboard> {
  requireChasingPermission(user);
  const [{ settings, pending }, historyRows, auditRows, preferenceRows] = await Promise.all([
    buildPendingItems(workspaceId, user),
    prismaAny.clientChaseAttempt.findMany({
      where: { workspaceId },
      include: {
        client: true,
        matter: true
      },
      orderBy: { createdAt: "desc" },
      take: 30
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        action: { startsWith: "client_chasing." }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prismaAny.clientChasingPreference.findMany({
      where: { workspaceId },
      include: { client: true },
      orderBy: { updatedAt: "desc" },
      take: 20
    })
  ]);

  return {
    settings,
    pending,
    history: historyRows.map((row: any) => ({
      id: row.id,
      sourceType: row.sourceType,
      channel: row.channel,
      status: row.status,
      mode: row.mode,
      createdAt: new Date(row.createdAt).toISOString(),
      processedAt: row.processedAt ? new Date(row.processedAt).toISOString() : null,
      blockedReason: row.blockedReason || null,
      clientName: row.client ? `${row.client.firstName} ${row.client.lastName}`.trim() : "Unknown client",
      matterReference: row.matter?.matterReference || null,
      preview: row.previewJson || null
    })),
    audit: auditRows.map((row) => ({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt,
      metadata: redactChasingMetadata((row.metadataJson || {}) as Record<string, unknown>)
    })),
    preferences: preferenceRows.map((row: any) => ({
      clientId: row.clientId,
      clientName: row.client ? `${row.client.firstName} ${row.client.lastName}`.trim() : "Unknown client",
      emailEnabled: Boolean(row.emailEnabled),
      smsEnabled: Boolean(row.smsEnabled),
      pushEnabled: Boolean(row.pushEnabled),
      portalEnabled: Boolean(row.portalEnabled),
      optedOutNonEssential: Boolean(row.optedOutNonEssential)
    }))
  };
}
