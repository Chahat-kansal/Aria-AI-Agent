import { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCalendarProviderStatus, type CalendarConnectionContext } from "@/lib/providers/calendar-provider";
import { getCalendarProviderAdapter } from "@/lib/services/calendar/calendar-integration";
import {
  assertSafeCalendarPayload,
  buildPrivacySafeCalendarDescription,
  buildPrivacySafeCalendarTitle,
  sanitizeCalendarError,
  type SafeCalendarEventPayload
} from "@/lib/services/calendar/calendar-safety";
import { getWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { auditEvent } from "@/lib/services/audit";

type SyncTone = "neutral" | "warning" | "success" | "info" | "danger";
type AppointmentSyncState = "NOT_CONFIGURED" | "NEEDS_CONNECTION" | "DRY_RUN_READY" | "SYNCED" | "CANCELLED" | "FAILED";
const AppointmentSyncState = {
  NOT_CONFIGURED: "NOT_CONFIGURED",
  NEEDS_CONNECTION: "NEEDS_CONNECTION",
  DRY_RUN_READY: "DRY_RUN_READY",
  SYNCED: "SYNCED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED"
} as const;
const calendarSyncDelegate = (prisma as any).calendarSyncEvent;

export type AppointmentCalendarSyncView = {
  state: AppointmentSyncState | "PROVIDER_DISABLED";
  tone: SyncTone;
  label: string;
  detail: string;
  providerName: string;
  lastSyncedAt: string | null;
  lastErrorSummary: string | null;
  hasRetryAction: boolean;
};

type AppointmentRecord = {
  id: string;
  workspaceId: string;
  meetingType: string;
  startsAt: Date;
  status: AppointmentStatus;
};

function getDurationMinutes(meetingType: string, settings: Awaited<ReturnType<typeof getWorkspaceOperationalSettingsView>>) {
  const types = settings.appointmentTypes as Array<{ key: string; label: string; durationMinutes: number }>;
  const normalized = meetingType.split(/-|·|Â·/)[0]?.trim().toLowerCase();
  const exact = types.find((item) => item.label.trim().toLowerCase() === normalized);
  return exact?.durationMinutes ?? types[0]?.durationMinutes ?? 45;
}

function buildPayload(input: {
  appointment: AppointmentRecord;
  workspaceName: string;
  timeZone: string;
  durationMinutes: number;
  calendarId?: string | null;
}) {
  const end = new Date(input.appointment.startsAt.getTime() + input.durationMinutes * 60 * 1000);
  const timeLabel = input.appointment.startsAt.toLocaleString("en-AU", {
    timeZone: input.timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
  const payload: SafeCalendarEventPayload = {
    title: buildPrivacySafeCalendarTitle(input.workspaceName),
    description: buildPrivacySafeCalendarDescription({
      workspaceName: input.workspaceName,
      timeLabel,
      includeVideoPlaceholder: true
    }),
    startIso: input.appointment.startsAt.toISOString(),
    endIso: end.toISOString(),
    timeZone: input.timeZone,
    calendarId: input.calendarId ?? null,
    meetingMethod: null,
    location: null
  };

  if (!assertSafeCalendarPayload(payload)) {
    throw new Error("Calendar payload safety validation failed.");
  }

  return payload;
}

async function auditCalendarAction(input: {
  workspaceId: string;
  userId: string;
  action: string;
  metadata?: Prisma.InputJsonObject;
}) {
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "CalendarSyncEvent",
    entityId: "calendar",
    action: input.action,
    metadata: input.metadata
  });
}

async function upsertSyncRow(input: {
  workspaceId: string;
  appointmentId: string;
  actorUserId?: string | null;
  provider: string;
  calendarId?: string | null;
  providerEventId?: string | null;
  syncStatus: AppointmentSyncState;
  lastErrorSummary?: string | null;
  payloadPreviewJson?: Prisma.InputJsonObject | null;
  markSynced?: boolean;
}) {
  const now = new Date();
  return calendarSyncDelegate.upsert({
    where: { appointmentId: input.appointmentId },
    create: {
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      actorUserId: input.actorUserId ?? null,
      provider: input.provider,
      calendarId: input.calendarId ?? null,
      providerEventId: input.providerEventId ?? null,
      syncStatus: input.syncStatus,
      lastAttemptedAt: now,
      lastSyncedAt: input.markSynced ? now : null,
      lastErrorSummary: input.lastErrorSummary ?? null,
      payloadPreviewJson: input.payloadPreviewJson ?? undefined
    },
    update: {
      actorUserId: input.actorUserId ?? null,
      provider: input.provider,
      calendarId: input.calendarId ?? null,
      providerEventId: input.providerEventId ?? undefined,
      syncStatus: input.syncStatus,
      lastAttemptedAt: now,
      lastSyncedAt: input.markSynced ? now : undefined,
      lastErrorSummary: input.lastErrorSummary ?? null,
      payloadPreviewJson: input.payloadPreviewJson ?? undefined
    }
  });
}

export async function syncAppointmentToCalendar(input: {
  workspaceId: string;
  appointmentId: string;
  userId: string;
  dryRun?: boolean;
}) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    include: { calendarSyncEvent: true, workspace: true }
  } as any) as any;
  if (!appointment) {
    return { ok: false, reason: "Appointment not found.", state: "FAILED" as const };
  }

  const providerStatus = getCalendarProviderStatus();
  const settings = await getWorkspaceOperationalSettingsView(input.workspaceId);
  const connection = await getWorkspaceProviderConnection(input.workspaceId, "calendar");
  const context: CalendarConnectionContext = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    provider: providerStatus.providerName as CalendarConnectionContext["provider"],
    selectedCalendarId: typeof connection?.metadataJson?.selectedCalendarId === "string" ? connection.metadataJson.selectedCalendarId : null
  };
  const payload = buildPayload({
    appointment,
    workspaceName: appointment.workspace.name,
    timeZone: settings.appointmentTimezone,
    durationMinutes: getDurationMinutes(appointment.meetingType, settings),
    calendarId: context.selectedCalendarId
  });

  if (providerStatus.state === "disabled" || !providerStatus.configured) {
    const sync = await upsertSyncRow({
      workspaceId: input.workspaceId,
      appointmentId: appointment.id,
      actorUserId: input.userId,
      provider: providerStatus.providerName,
      calendarId: context.selectedCalendarId,
      syncStatus: AppointmentSyncState.NOT_CONFIGURED,
      lastErrorSummary: providerStatus.disabledReason || "Calendar provider not configured.",
      payloadPreviewJson: payload as unknown as Prisma.InputJsonObject
    });
    return { ok: true, dryRun: true, state: sync.syncStatus, payload };
  }

  if (!connection?.connected) {
    const sync = await upsertSyncRow({
      workspaceId: input.workspaceId,
      appointmentId: appointment.id,
      actorUserId: input.userId,
      provider: providerStatus.providerName,
      calendarId: context.selectedCalendarId,
      syncStatus: AppointmentSyncState.NEEDS_CONNECTION,
      lastErrorSummary: "Calendar provider needs connection.",
      payloadPreviewJson: payload as unknown as Prisma.InputJsonObject
    });
    return { ok: true, dryRun: true, state: sync.syncStatus, payload };
  }

  if (input.dryRun) {
    await auditCalendarAction({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: "calendar.connection_tested",
      metadata: { appointmentId: appointment.id, provider: providerStatus.providerName }
    });
    const sync = await upsertSyncRow({
      workspaceId: input.workspaceId,
      appointmentId: appointment.id,
      actorUserId: input.userId,
      provider: providerStatus.providerName,
      calendarId: context.selectedCalendarId,
      providerEventId: appointment.calendarSyncEvent?.providerEventId ?? null,
      syncStatus: AppointmentSyncState.DRY_RUN_READY,
      lastErrorSummary: null,
      payloadPreviewJson: payload as unknown as Prisma.InputJsonObject
    });
    return { ok: true, dryRun: true, state: sync.syncStatus, payload };
  }

  try {
    const adapter = await getCalendarProviderAdapter(context);
    await auditCalendarAction({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: "calendar.appointment_synced",
      metadata: { appointmentId: appointment.id, phase: "started", provider: providerStatus.providerName }
    });
    const result = await adapter.syncAppointment({
      ...context,
      payload,
      providerEventId: appointment.calendarSyncEvent?.providerEventId ?? null,
      cancelled: appointment.status === AppointmentStatus.CANCELLED
    });

    if (!result.ok) throw new Error(result.reason || "Calendar sync failed.");

    const sync = await upsertSyncRow({
      workspaceId: input.workspaceId,
      appointmentId: appointment.id,
      actorUserId: input.userId,
      provider: providerStatus.providerName,
      calendarId: context.selectedCalendarId,
      providerEventId: result.providerEventId ?? appointment.calendarSyncEvent?.providerEventId ?? null,
      syncStatus: appointment.status === AppointmentStatus.CANCELLED ? AppointmentSyncState.CANCELLED : AppointmentSyncState.SYNCED,
      lastErrorSummary: null,
      payloadPreviewJson: payload as unknown as Prisma.InputJsonObject,
      markSynced: true
    });
    return { ok: true, dryRun: false, state: sync.syncStatus, payload };
  } catch (error) {
    const reason = sanitizeCalendarError(error);
    await auditCalendarAction({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: "calendar.appointment_sync_failed",
      metadata: { appointmentId: appointment.id, provider: providerStatus.providerName, reason }
    });
    const sync = await upsertSyncRow({
      workspaceId: input.workspaceId,
      appointmentId: appointment.id,
      actorUserId: input.userId,
      provider: providerStatus.providerName,
      calendarId: context.selectedCalendarId,
      providerEventId: appointment.calendarSyncEvent?.providerEventId ?? null,
      syncStatus: AppointmentSyncState.FAILED,
      lastErrorSummary: reason,
      payloadPreviewJson: payload as unknown as Prisma.InputJsonObject
    });
    return { ok: false, dryRun: false, state: sync.syncStatus, reason, payload };
  }
}

export async function getAppointmentCalendarSyncView(appointmentId: string, _workspaceId: string): Promise<AppointmentCalendarSyncView> {
  const [sync, providerStatus] = await Promise.all([
    calendarSyncDelegate.findUnique({ where: { appointmentId } }),
    Promise.resolve(getCalendarProviderStatus())
  ]);

  if (!sync) {
    if (providerStatus.state === "disabled" || !providerStatus.configured) {
      return {
        state: "PROVIDER_DISABLED",
        tone: "neutral",
        label: "Provider disabled",
        detail: providerStatus.disabledReason || "Calendar provider not configured.",
        providerName: providerStatus.providerName,
        lastSyncedAt: null,
        lastErrorSummary: null,
        hasRetryAction: false
      };
    }
    return {
      state: AppointmentSyncState.NEEDS_CONNECTION,
      tone: "warning",
      label: "Needs connection",
      detail: "Connect a provider or use manual scheduling only.",
      providerName: providerStatus.providerName,
      lastSyncedAt: null,
      lastErrorSummary: null,
      hasRetryAction: false
    };
  }

  const toneByState: Record<AppointmentCalendarSyncView["state"], SyncTone> = {
    PROVIDER_DISABLED: "neutral",
    NOT_CONFIGURED: "neutral",
    NEEDS_CONNECTION: "warning",
    DRY_RUN_READY: "info",
    SYNCED: "success",
    CANCELLED: "neutral",
    FAILED: "danger"
  };
  const labelByState: Record<Exclude<AppointmentCalendarSyncView["state"], "PROVIDER_DISABLED">, string> = {
    NOT_CONFIGURED: "Not configured",
    NEEDS_CONNECTION: "Needs connection",
    DRY_RUN_READY: "Dry-run ready",
    SYNCED: "Synced",
    CANCELLED: "Cancelled",
    FAILED: "Sync failed"
  };
  const syncState = sync.syncStatus as AppointmentSyncState;

  return {
    state: syncState,
    tone: toneByState[syncState],
    label: labelByState[syncState],
    detail: sync.lastErrorSummary || (syncState === AppointmentSyncState.SYNCED ? "Privacy-safe calendar event synced." : "Manual Aria booking remains available."),
    providerName: sync.provider,
    lastSyncedAt: sync.lastSyncedAt?.toISOString() ?? null,
    lastErrorSummary: sync.lastErrorSummary,
    hasRetryAction: syncState === AppointmentSyncState.FAILED || syncState === AppointmentSyncState.DRY_RUN_READY
  };
}

export async function listAppointmentCalendarSyncViews(workspaceId: string, appointmentIds: string[]) {
  const [syncRows, providerStatus] = await Promise.all([
    calendarSyncDelegate.findMany({ where: { workspaceId, appointmentId: { in: appointmentIds } } }),
    Promise.resolve(getCalendarProviderStatus())
  ]);
  const syncMap = new Map(syncRows.map((item: any) => [item.appointmentId, item]));
  const result = new Map<string, AppointmentCalendarSyncView>();
  for (const appointmentId of appointmentIds) {
    const existing = syncMap.get(appointmentId);
    if (!existing) {
      result.set(appointmentId, {
        state: providerStatus.state === "disabled" || !providerStatus.configured ? "PROVIDER_DISABLED" : AppointmentSyncState.NEEDS_CONNECTION,
        tone: providerStatus.state === "disabled" || !providerStatus.configured ? "neutral" : "warning",
        label: providerStatus.state === "disabled" || !providerStatus.configured ? "Provider disabled" : "Needs connection",
        detail: providerStatus.disabledReason || "Connect a provider or use manual scheduling only.",
        providerName: providerStatus.providerName,
        lastSyncedAt: null,
        lastErrorSummary: null,
        hasRetryAction: false
      });
      continue;
    }
    result.set(appointmentId, await getAppointmentCalendarSyncView(appointmentId, workspaceId));
  }
  return result;
}
