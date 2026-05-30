import {
  type CalendarAvailabilityResult,
  type CalendarCalendarSummary,
  type CalendarConnectionContext,
  type CalendarProviderAdapter,
  type CalendarProviderName,
  type CalendarProviderResult,
  getCalendarProviderName,
  getCalendarProviderStatus
} from "@/lib/providers/calendar-provider";
import { sanitizeCalendarError, type SafeCalendarEventPayload } from "@/lib/services/calendar/calendar-safety";
import {
  decodeCalendarOAuthState,
  disconnectCalendarProvider,
  getCalendarAuthorizationUrl,
  handleCalendarOAuthCallback,
  refreshCalendarProviderTokens
} from "@/lib/services/calendar/calendar-oauth";
import {
  decryptStoredProviderToken,
  getWorkspaceProviderConnection,
  recordWorkspaceProviderActivity,
  upsertWorkspaceProviderConnection
} from "@/lib/services/oauth-token-vault";
import { auditEvent } from "@/lib/services/audit";
import { prisma } from "@/lib/prisma";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { buildPrivacySafeCalendarDescription, buildPrivacySafeCalendarTitle } from "@/lib/services/calendar/calendar-safety";
import { getEmailProviderStatus } from "@/lib/providers/email-provider";
import { getSmsProviderStatus } from "@/lib/providers/sms-provider";

type AuthorizedContext = CalendarConnectionContext & {
  accessToken: string | null;
};

async function auditCalendarAction(input: {
  workspaceId: string;
  userId: string;
  provider: CalendarProviderName;
  action: string;
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

async function getAuthorizedContext(context: CalendarConnectionContext): Promise<AuthorizedContext> {
  const connection = await getWorkspaceProviderConnection(context.workspaceId, "calendar");
  let accessToken = decryptStoredProviderToken(connection?.encryptedAccessToken);
  const expiresAt = connection?.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null;

  if (accessToken && expiresAt && expiresAt.getTime() <= Date.now() + 30_000) {
    const refreshed = await refreshCalendarProviderTokens(context);
    if (refreshed.ok) {
      const nextConnection = await getWorkspaceProviderConnection(context.workspaceId, "calendar");
      accessToken = decryptStoredProviderToken(nextConnection?.encryptedAccessToken);
    }
  }

  return { ...context, accessToken };
}

function getSelectedCalendarId(connection: Awaited<ReturnType<typeof getWorkspaceProviderConnection>>) {
  const metadata = connection?.metadataJson;
  if (!metadata || typeof metadata !== "object") return null;
  const value = metadata.selectedCalendarId;
  return typeof value === "string" && value.trim() ? value : null;
}

function buildGoogleEventBody(payload: SafeCalendarEventPayload) {
  return {
    summary: payload.title,
    description: payload.description,
    start: { dateTime: payload.startIso, timeZone: payload.timeZone },
    end: { dateTime: payload.endIso, timeZone: payload.timeZone },
    location: payload.location || undefined
  };
}

function buildMicrosoftEventBody(payload: SafeCalendarEventPayload) {
  return {
    subject: payload.title,
    body: {
      contentType: "text",
      content: payload.description
    },
    start: { dateTime: payload.startIso, timeZone: payload.timeZone },
    end: { dateTime: payload.endIso, timeZone: payload.timeZone },
    location: payload.location ? { displayName: payload.location } : undefined
  };
}

async function googleRequest<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`Google Calendar request failed: ${response.status}`);
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
  if (!response.ok) throw new Error(`Microsoft Calendar request failed: ${response.status}`);
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

function baseUnavailableAvailability(provider: CalendarProviderName, reason: string): CalendarAvailabilityResult {
  return {
    provider,
    available: false,
    source: "manual",
    busyWindows: [],
    lastCheckedAt: null,
    reason
  };
}

export async function getCalendarProviderAdapter(context: CalendarConnectionContext): Promise<CalendarProviderAdapter> {
  const provider = getCalendarProviderName();

  const createEvent: CalendarProviderAdapter["createEvent"] = async (requestContext) => {
    const authorized = await getAuthorizedContext(requestContext);
    if (!authorized.accessToken) {
      return { ok: false, provider: authorized.provider, reason: "Calendar provider not configured or connected." };
    }

    try {
      const connection = await getWorkspaceProviderConnection(authorized.workspaceId, "calendar");
      const calendarId = requestContext.selectedCalendarId || getSelectedCalendarId(connection) || (authorized.provider === "google" ? "primary" : null);
      const response = authorized.provider === "google"
        ? await googleRequest<{ id?: string }>(
            authorized.accessToken,
            `/calendars/${encodeURIComponent(calendarId || "primary")}/events`,
            { method: "POST", body: JSON.stringify(buildGoogleEventBody(requestContext.payload)) }
          )
        : await microsoftRequest<{ id?: string }>(
            authorized.accessToken,
            calendarId ? `/me/calendars/${encodeURIComponent(calendarId)}/events` : "/me/events",
            { method: "POST", body: JSON.stringify(buildMicrosoftEventBody(requestContext.payload)) }
          );
      await auditCalendarAction({
        workspaceId: authorized.workspaceId,
        userId: authorized.userId,
        provider: authorized.provider,
        action: "calendar.event_created",
        metadata: { calendarId: calendarId || "primary" }
      });
      return { ok: true, provider: authorized.provider, providerEventId: response?.id ?? null, lastSyncedAt: new Date().toISOString() };
    } catch (error) {
      return { ok: false, provider: authorized.provider, reason: sanitizeCalendarError(error) };
    }
  };

  const updateEvent: CalendarProviderAdapter["updateEvent"] = async (requestContext) => {
    const authorized = await getAuthorizedContext(requestContext);
    if (!authorized.accessToken) {
      return { ok: false, provider: authorized.provider, reason: "Calendar provider not configured or connected." };
    }

    try {
      const connection = await getWorkspaceProviderConnection(authorized.workspaceId, "calendar");
      const calendarId = requestContext.selectedCalendarId || getSelectedCalendarId(connection) || (authorized.provider === "google" ? "primary" : null);
      if (authorized.provider === "google") {
        await googleRequest(
          authorized.accessToken,
          `/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(requestContext.providerEventId)}`,
          { method: "PATCH", body: JSON.stringify(buildGoogleEventBody(requestContext.payload)) }
        );
      } else {
        await microsoftRequest(
          authorized.accessToken,
          `/me/events/${encodeURIComponent(requestContext.providerEventId)}`,
          { method: "PATCH", body: JSON.stringify(buildMicrosoftEventBody(requestContext.payload)) }
        );
      }
      await auditCalendarAction({
        workspaceId: authorized.workspaceId,
        userId: authorized.userId,
        provider: authorized.provider,
        action: "calendar.event_updated"
      });
      return { ok: true, provider: authorized.provider, providerEventId: requestContext.providerEventId, lastSyncedAt: new Date().toISOString() };
    } catch (error) {
      return { ok: false, provider: authorized.provider, reason: sanitizeCalendarError(error) };
    }
  };

  const cancelEvent: CalendarProviderAdapter["cancelEvent"] = async (requestContext) => {
    const authorized = await getAuthorizedContext(requestContext);
    if (!authorized.accessToken) {
      return { ok: false, provider: authorized.provider, reason: "Calendar provider not configured or connected." };
    }

    try {
      const connection = await getWorkspaceProviderConnection(authorized.workspaceId, "calendar");
      const calendarId = requestContext.selectedCalendarId || getSelectedCalendarId(connection) || (authorized.provider === "google" ? "primary" : null);
      if (authorized.provider === "google") {
        await googleRequest(
          authorized.accessToken,
          `/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(requestContext.providerEventId)}`,
          { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }
        );
      } else {
        await microsoftRequest(
          authorized.accessToken,
          `/me/events/${encodeURIComponent(requestContext.providerEventId)}`,
          { method: "DELETE" }
        );
      }
      await auditCalendarAction({
        workspaceId: authorized.workspaceId,
        userId: authorized.userId,
        provider: authorized.provider,
        action: "calendar.event_cancelled"
      });
      return { ok: true, provider: authorized.provider, providerEventId: requestContext.providerEventId, lastSyncedAt: new Date().toISOString() };
    } catch (error) {
      return { ok: false, provider: authorized.provider, reason: sanitizeCalendarError(error) };
    }
  };

  const syncAppointment: CalendarProviderAdapter["syncAppointment"] = async (requestContext) => {
    if (requestContext.cancelled && requestContext.providerEventId) {
      return cancelEvent({ ...requestContext, providerEventId: requestContext.providerEventId });
    }
    if (requestContext.providerEventId) {
      return updateEvent({ ...requestContext, providerEventId: requestContext.providerEventId });
    }
    return createEvent(requestContext);
  };

  return {
    getProviderStatus: () => getCalendarProviderStatus(),
    getAuthorizationUrl: getCalendarAuthorizationUrl,
    handleOAuthCallback: handleCalendarOAuthCallback,
    refreshToken: refreshCalendarProviderTokens,
    disconnect: disconnectCalendarProvider,
    async listCalendars(requestContext) {
      const authorized = await getAuthorizedContext(requestContext);
      if (!authorized.accessToken) return [];
      if (authorized.provider === "google") {
        const response = await googleRequest<{ items?: Array<{ id: string; summary: string; primary?: boolean }> }>(
          authorized.accessToken,
          "/users/me/calendarList"
        );
        return (response.items ?? []).map((item) => ({ id: item.id, name: item.summary, primary: item.primary }));
      }
      if (authorized.provider === "microsoft") {
        const response = await microsoftRequest<{ value?: Array<{ id: string; name: string; isDefaultCalendar?: boolean }> }>(
          authorized.accessToken,
          "/me/calendars?$select=id,name,isDefaultCalendar"
        );
        return (response.value ?? []).map((item) => ({ id: item.id, name: item.name, primary: item.isDefaultCalendar }));
      }
      return [];
    },
    async getAvailability(requestContext) {
      const authorized = await getAuthorizedContext(requestContext);
      if (!authorized.accessToken) {
        return baseUnavailableAvailability(authorized.provider, "Calendar provider not configured or connected.");
      }

      try {
        if (authorized.provider === "google") {
          const connection = await getWorkspaceProviderConnection(authorized.workspaceId, "calendar");
          const calendarId = requestContext.selectedCalendarId || getSelectedCalendarId(connection) || "primary";
          const response = await googleRequest<{
            calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
          }>(authorized.accessToken, "/freeBusy", {
            method: "POST",
            body: JSON.stringify({
              timeMin: requestContext.startIso,
              timeMax: requestContext.endIso,
              items: [{ id: calendarId }]
            })
          });
          await auditCalendarAction({
            workspaceId: authorized.workspaceId,
            userId: authorized.userId,
            provider: authorized.provider,
            action: "calendar.availability_checked",
            metadata: { calendarId }
          });
          return {
            provider: authorized.provider,
            available: true,
            source: "provider",
            busyWindows: response.calendars?.[calendarId]?.busy?.map((item) => ({ startIso: item.start, endIso: item.end })) ?? [],
            lastCheckedAt: new Date().toISOString()
          };
        }

        if (authorized.provider === "microsoft") {
          const connection = await getWorkspaceProviderConnection(authorized.workspaceId, "calendar");
          const calendarId = requestContext.selectedCalendarId || getSelectedCalendarId(connection) || "me";
          const response = await microsoftRequest<{
            value?: Array<{ scheduleItems?: Array<{ start: { dateTime: string }; end: { dateTime: string } }> }>;
          }>(authorized.accessToken, "/me/calendar/getSchedule", {
            method: "POST",
            body: JSON.stringify({
              schedules: [calendarId],
              startTime: { dateTime: requestContext.startIso, timeZone: "UTC" },
              endTime: { dateTime: requestContext.endIso, timeZone: "UTC" },
              availabilityViewInterval: 30
            })
          });
          await auditCalendarAction({
            workspaceId: authorized.workspaceId,
            userId: authorized.userId,
            provider: authorized.provider,
            action: "calendar.availability_checked",
            metadata: { calendarId }
          });
          const items = response.value?.[0]?.scheduleItems ?? [];
          return {
            provider: authorized.provider,
            available: true,
            source: "provider",
            busyWindows: items.map((item) => ({ startIso: item.start.dateTime, endIso: item.end.dateTime })),
            lastCheckedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        const reason = sanitizeCalendarError(error);
        await recordWorkspaceProviderActivity({
          workspaceId: authorized.workspaceId,
          key: "calendar",
          providerName: authorized.provider,
          lastErrorSummary: reason,
          connectionState: "attention_required"
        });
        return baseUnavailableAvailability(authorized.provider, reason);
      }

      return baseUnavailableAvailability(authorized.provider, "Calendar provider not configured.");
    },
    createEvent,
    updateEvent,
    cancelEvent,
    syncAppointment,
    dryRunEventPayload(payload) {
      return payload;
    }
  };
}

export async function resolveCalendarOAuthCallbackState(state: string | null | undefined) {
  return decodeCalendarOAuthState(state);
}

export async function listConnectedCalendars(context: CalendarConnectionContext): Promise<CalendarCalendarSummary[]> {
  const adapter = await getCalendarProviderAdapter(context);
  return adapter.listCalendars(context);
}

function buildDryRunPreview(workspaceName: string, timeZone: string) {
  const startsAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 45 * 60 * 1000);
  const timeLabel = startsAt.toLocaleString("en-AU", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

  return {
    title: buildPrivacySafeCalendarTitle(workspaceName),
    description: buildPrivacySafeCalendarDescription({
      workspaceName,
      timeLabel,
      includeVideoPlaceholder: true
    }),
    startIso: startsAt.toISOString(),
    endIso: endsAt.toISOString(),
    timeZone,
    location: null,
    meetingMethod: null
  };
}

export async function getCalendarIntegrationView(workspaceId: string, userId: string) {
  const provider = getCalendarProviderStatus();
  const connection = await getWorkspaceProviderConnection(workspaceId, "calendar");
  const context: CalendarConnectionContext = {
    workspaceId,
    userId,
    provider: getCalendarProviderName(),
    selectedCalendarId: typeof connection?.metadataJson?.selectedCalendarId === "string" ? connection.metadataJson.selectedCalendarId : null
  };
  const [recentAudit, settings] = await Promise.all([
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        action: {
          in: [
            "calendar.provider_connected",
            "calendar.provider_disconnected",
            "calendar.connection_tested",
            "calendar.availability_checked",
            "calendar.appointment_synced",
            "calendar.appointment_sync_failed",
            "calendar.event_created",
            "calendar.event_updated",
            "calendar.event_cancelled",
            "calendar.token_refreshed",
            "calendar.token_revoked"
          ]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    getWorkspaceOperationalSettingsView(workspaceId)
  ]);

  let calendars: CalendarCalendarSummary[] = [];
  if (provider.configured && connection?.connected) {
    try {
      calendars = await listConnectedCalendars(context);
    } catch {
      calendars = [];
    }
  }

  return {
    provider,
    connection,
    recentAudit,
    calendars,
    selectedCalendarId: context.selectedCalendarId,
    authorizationUrl: provider.configured ? getCalendarAuthorizationUrl(context) : null,
    dryRunPreview: buildDryRunPreview(
      "Aria Migration Practice",
      settings.appointmentTimezone
    )
  };
}

export async function runCalendarConnectionTest(input: { workspaceId: string; userId: string }) {
  const provider = getCalendarProviderStatus();
  const context: CalendarConnectionContext = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    provider: getCalendarProviderName()
  };
  if (!provider.configured) {
    await auditCalendarAction({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: context.provider,
      action: "calendar.connection_tested",
      metadata: { result: "not_configured" }
    });
    return { ok: true, result: "not_configured" as const, calendars: [] as CalendarCalendarSummary[] };
  }

  const calendars = await listConnectedCalendars(context);
  await auditCalendarAction({
    workspaceId: input.workspaceId,
    userId: input.userId,
    provider: context.provider,
    action: "calendar.connection_tested",
    metadata: { result: connectionStateForCalendars(calendars), calendarCount: calendars.length }
  });
  return { ok: true, result: calendars.length ? ("connected" as const) : ("configured_without_list" as const), calendars };
}

function connectionStateForCalendars(calendars: CalendarCalendarSummary[]) {
  return calendars.length ? "connected" : "configured_without_list";
}

export async function saveSelectedCalendar(input: {
  workspaceId: string;
  userId: string;
  calendarId: string | null;
}) {
  const connection = await getWorkspaceProviderConnection(input.workspaceId, "calendar");
  if (!connection) return null;
  return upsertWorkspaceProviderConnection({
    workspaceId: input.workspaceId,
    key: "calendar",
    providerName: connection.providerName,
    tokenExpiresAt: connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null,
    scopes: connection.scopes,
    connectedAccountLabel: connection.connectedAccountLabel,
    metadataJson: {
      ...(connection.metadataJson ?? {}),
      selectedCalendarId: input.calendarId
    },
    lastSuccessfulActionAt: new Date(),
    lastErrorSummary: null
  });
}

function buildManualSlots(input: {
  availability: Array<{ weekday: number; start: string; end: string }>;
  durationMinutes: number;
  minNoticeHours: number;
  timeZone: string;
  busyWindows?: Array<{ startIso: string; endIso: string }>;
}) {
  const slots: Array<{ label: string; value: string }> = [];
  const now = new Date();
  const minStart = new Date(now.getTime() + input.minNoticeHours * 60 * 60 * 1000);
  const busyRanges = (input.busyWindows ?? []).map((item) => ({
    start: new Date(item.startIso).getTime(),
    end: new Date(item.endIso).getTime()
  }));

  for (let dayOffset = 0; dayOffset < 14 && slots.length < 9; dayOffset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + dayOffset);
    const windows = input.availability.filter((item) => item.weekday === day.getDay());
    for (const window of windows) {
      const [startHour, startMinute] = window.start.split(":").map(Number);
      const [endHour, endMinute] = window.end.split(":").map(Number);
      const start = new Date(day);
      start.setHours(startHour, startMinute, 0, 0);
      const end = new Date(day);
      end.setHours(endHour, endMinute, 0, 0);
      for (let cursor = new Date(start); cursor < end && slots.length < 9; cursor = new Date(cursor.getTime() + input.durationMinutes * 60 * 1000)) {
        if (cursor < minStart) continue;
        const nextEnd = new Date(cursor.getTime() + input.durationMinutes * 60 * 1000);
        if (nextEnd > end) continue;
        const overlapsBusy = busyRanges.some((range) => cursor.getTime() < range.end && nextEnd.getTime() > range.start);
        if (overlapsBusy) continue;
        slots.push({
          value: cursor.toISOString(),
          label: cursor.toLocaleString("en-AU", {
            timeZone: input.timeZone,
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          })
        });
      }
    }
  }

  return slots;
}

export async function getWorkspaceAppointmentBookingExperience(input: {
  workspaceId: string;
  userId: string;
}) {
  const [settings, provider, connection] = await Promise.all([
    getWorkspaceOperationalSettingsView(input.workspaceId),
    Promise.resolve(getCalendarProviderStatus()),
    getWorkspaceProviderConnection(input.workspaceId, "calendar")
  ]);
  const appointmentTypes = settings.appointmentTypes as Array<{ key: string; label: string; durationMinutes: number }>;
  const availability = settings.appointmentAvailability as Array<{ weekday: number; start: string; end: string }>;
  const defaultType = appointmentTypes[0] ?? { key: "consultation", label: "Consultation", durationMinutes: 45 };
  const context: CalendarConnectionContext = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    provider: getCalendarProviderName(),
    selectedCalendarId: typeof connection?.metadataJson?.selectedCalendarId === "string" ? connection.metadataJson.selectedCalendarId : null
  };

  let busyWindows: Array<{ startIso: string; endIso: string }> = [];
  let availabilitySource: CalendarAvailabilityResult["source"] = "manual";
  let providerDetail = provider.disabledReason || "Calendar provider not configured.";

  if (provider.configured && connection?.connected) {
    const adapter = await getCalendarProviderAdapter(context);
    const external = await adapter.getAvailability({
      ...context,
      startIso: new Date().toISOString(),
      endIso: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    });
    busyWindows = external.busyWindows;
    availabilitySource = external.available ? "provider_plus_manual" : "manual";
    providerDetail = external.reason || "Connected calendar availability is applied to bookable slots.";
  }

  const slots = availability.length
    ? buildManualSlots({
        availability,
        durationMinutes: defaultType.durationMinutes,
        minNoticeHours: settings.appointmentMinNoticeHours,
        timeZone: settings.appointmentTimezone,
        busyWindows
      })
    : [];

  return {
    appointmentTypes,
    meetingMethods: settings.appointmentMeetingMethods as string[],
    availability,
    defaultType,
    availableSlots: slots,
    availabilitySource,
    providerDetail
  };
}

export function getAppointmentReminderHooks() {
  const email = getEmailProviderStatus();
  const sms = getSmsProviderStatus();
  return {
    inAppEnabled: true,
    emailEnabled: email.configured,
    smsEnabled: sms.configured,
    reminderCopy: "You have an upcoming appointment with your migration team. Please log in to your secure portal for details."
  };
}
