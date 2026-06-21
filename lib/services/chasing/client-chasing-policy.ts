import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";

export type ClientChaseSourceType =
  | "missing_documents"
  | "pending_confirmation"
  | "appointment"
  | "unpaid_invoice"
  | "unread_portal_message";

export type ClientChaseChannel = "portal" | "email" | "sms" | "push";

export type ClientChasingChannels = Record<ClientChaseChannel, boolean>;

export type ClientChasingQuietHours = {
  enabled: boolean;
  start: string | null;
  end: string | null;
  timezone: string | null;
  placeholder: boolean;
};

export const DEFAULT_CLIENT_CHASING_CHANNELS: ClientChasingChannels = {
  portal: true,
  email: true,
  sms: false,
  push: false
};

export const CLIENT_CHASE_SOURCE_LABELS: Record<ClientChaseSourceType, string> = {
  missing_documents: "Pending document reminder",
  pending_confirmation: "Pending confirmation reminder",
  appointment: "Appointment reminder",
  unpaid_invoice: "Invoice reminder",
  unread_portal_message: "Unread portal message reminder"
};

export type ClientChasingSettingsView = Awaited<ReturnType<typeof getClientChasingSettingsView>>;

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function parseClientChasingChannels(value: unknown): ClientChasingChannels {
  const parsed = jsonObject(value);
  return {
    portal: typeof parsed.portal === "boolean" ? parsed.portal : DEFAULT_CLIENT_CHASING_CHANNELS.portal,
    email: typeof parsed.email === "boolean" ? parsed.email : DEFAULT_CLIENT_CHASING_CHANNELS.email,
    sms: typeof parsed.sms === "boolean" ? parsed.sms : DEFAULT_CLIENT_CHASING_CHANNELS.sms,
    push: typeof parsed.push === "boolean" ? parsed.push : DEFAULT_CLIENT_CHASING_CHANNELS.push
  };
}

export function parseClientChasingQuietHours(value: unknown, timezone: string | null): ClientChasingQuietHours {
  const parsed = jsonObject(value);
  return {
    enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : false,
    start: typeof parsed.start === "string" && parsed.start.trim() ? parsed.start : null,
    end: typeof parsed.end === "string" && parsed.end.trim() ? parsed.end : null,
    timezone: typeof parsed.timezone === "string" && parsed.timezone.trim() ? parsed.timezone : timezone,
    placeholder: !(typeof parsed.enabled === "boolean")
  };
}

export async function getClientChasingSettingsView(workspaceId: string) {
  const settings = await getWorkspaceOperationalSettingsView(workspaceId);
  return {
    enabled: Boolean(settings.clientChasingEnabled ?? false),
    autoSendEnabled: Boolean(settings.clientChasingAutoSendEnabled ?? false),
    consentRequired: Boolean(settings.clientChasingConsentRequired ?? true),
    frequencyHours: Number(settings.clientChasingFrequencyHours ?? 48) || 48,
    channels: parseClientChasingChannels(settings.clientChasingChannels ?? null),
    quietHours: parseClientChasingQuietHours(
      settings.clientChasingQuietHours ?? null,
      settings.appointmentTimezone || "Australia/Sydney"
    ),
    timezone: settings.appointmentTimezone || "Australia/Sydney"
  };
}

function minutesFromClock(value: string | null) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function currentMinutesInTimezone(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((item) => item.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((item) => item.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isWithinClientChasingQuietHours(input: {
  now?: Date;
  quietHours: ClientChasingQuietHours;
  timezone: string;
}) {
  const { quietHours, timezone } = input;
  if (!quietHours.enabled) return false;
  const start = minutesFromClock(quietHours.start);
  const end = minutesFromClock(quietHours.end);
  if (start === null || end === null) return false;
  const current = currentMinutesInTimezone(input.now ?? new Date(), quietHours.timezone || timezone);
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function channelLabel(channel: ClientChaseChannel) {
  return channel === "portal" ? "Portal" : channel === "sms" ? "SMS" : channel === "push" ? "Push" : "Email";
}
