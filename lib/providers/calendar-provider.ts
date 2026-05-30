import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";
import type { SafeCalendarEventPayload } from "@/lib/services/calendar/calendar-safety";

export type CalendarProviderName = "google" | "microsoft" | "disabled";

export type CalendarConnectionContext = {
  workspaceId: string;
  userId: string;
  provider: CalendarProviderName;
  selectedCalendarId?: string | null;
};

export type CalendarOAuthCallbackInput = CalendarConnectionContext & {
  code: string;
};

export type CalendarCalendarSummary = {
  id: string;
  name: string;
  primary?: boolean;
};

export type CalendarBusyWindow = {
  startIso: string;
  endIso: string;
};

export type CalendarAvailabilityResult = {
  provider: CalendarProviderName;
  available: boolean;
  source: "manual" | "provider" | "provider_plus_manual";
  busyWindows: CalendarBusyWindow[];
  lastCheckedAt: string | null;
  reason?: string | null;
};

export type CalendarProviderResult = {
  ok: boolean;
  provider: CalendarProviderName;
  reason?: string | null;
  providerEventId?: string | null;
  lastSyncedAt?: string | null;
};

export type CalendarProviderAdapter = {
  getProviderStatus: () => ProviderStatus;
  getAuthorizationUrl: (context: CalendarConnectionContext) => string | null;
  handleOAuthCallback: (input: CalendarOAuthCallbackInput) => Promise<CalendarProviderResult>;
  refreshToken: (context: CalendarConnectionContext) => Promise<CalendarProviderResult>;
  disconnect: (context: CalendarConnectionContext) => Promise<CalendarProviderResult>;
  listCalendars: (context: CalendarConnectionContext) => Promise<CalendarCalendarSummary[]>;
  getAvailability: (context: CalendarConnectionContext & { startIso: string; endIso: string }) => Promise<CalendarAvailabilityResult>;
  createEvent: (context: CalendarConnectionContext & { payload: SafeCalendarEventPayload }) => Promise<CalendarProviderResult>;
  updateEvent: (context: CalendarConnectionContext & { providerEventId: string; payload: SafeCalendarEventPayload }) => Promise<CalendarProviderResult>;
  cancelEvent: (context: CalendarConnectionContext & { providerEventId: string; payload?: SafeCalendarEventPayload | null }) => Promise<CalendarProviderResult>;
  syncAppointment: (context: CalendarConnectionContext & { payload: SafeCalendarEventPayload; providerEventId?: string | null; cancelled?: boolean }) => Promise<CalendarProviderResult>;
  dryRunEventPayload: (payload: SafeCalendarEventPayload) => SafeCalendarEventPayload;
};

export type CalendarProviderEnv = {
  provider: CalendarProviderName;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  providerConfigured: boolean;
  missingEnv: string[];
};

function getGoogleEnv() {
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || ""
  };
}

function getMicrosoftEnv() {
  return {
    clientId: process.env.MICROSOFT_CALENDAR_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || "",
    clientSecret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || "",
    tenantId: process.env.MICROSOFT_CALENDAR_TENANT_ID || process.env.MICROSOFT_TENANT_ID || "common",
    redirectUri: process.env.MICROSOFT_CALENDAR_REDIRECT_URI || process.env.MICROSOFT_REDIRECT_URI || ""
  };
}

export function getCalendarProviderName(): CalendarProviderName {
  const provider = (process.env.CALENDAR_PROVIDER || "disabled").trim().toLowerCase();
  if (provider === "google" || provider === "microsoft") return provider;
  return "disabled";
}

export function getCalendarProviderEnv(): CalendarProviderEnv {
  const provider = getCalendarProviderName();
  const google = getGoogleEnv();
  const microsoft = getMicrosoftEnv();
  const googleConfigured =
    hasConfiguredValue(google.clientId) &&
    hasConfiguredSecret(google.clientSecret) &&
    hasConfiguredValue(google.redirectUri);
  const microsoftConfigured =
    hasConfiguredValue(microsoft.clientId) &&
    hasConfiguredSecret(microsoft.clientSecret) &&
    hasConfiguredValue(microsoft.redirectUri);
  const providerConfigured = (provider === "google" && googleConfigured) || (provider === "microsoft" && microsoftConfigured);

  return {
    provider,
    googleConfigured,
    microsoftConfigured,
    providerConfigured,
    missingEnv: providerConfigured
      ? []
      : provider === "google"
        ? ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CALENDAR_REDIRECT_URI"]
        : provider === "microsoft"
          ? [
              "MICROSOFT_CALENDAR_CLIENT_ID",
              "MICROSOFT_CALENDAR_CLIENT_SECRET",
              "MICROSOFT_CALENDAR_TENANT_ID",
              "MICROSOFT_CALENDAR_REDIRECT_URI"
            ]
          : ["CALENDAR_PROVIDER"]
  };
}

export function getGoogleCalendarOAuthConfig() {
  return getGoogleEnv();
}

export function getMicrosoftCalendarOAuthConfig() {
  return getMicrosoftEnv();
}

export function getCalendarProviderStatus(): ProviderStatus {
  const env = getCalendarProviderEnv();

  return buildProviderStatus({
    key: "calendar",
    label: "Calendar sync",
    providerName: env.provider,
    configured: env.providerConfigured,
    state: env.provider === "disabled" ? "disabled" : env.providerConfigured ? "configured" : "not_configured",
    missingEnv: env.missingEnv,
    requiredSetupSteps: env.providerConfigured
      ? []
      : [
          "Choose CALENDAR_PROVIDER.",
          "Add OAuth credentials before enabling live availability or event sync.",
          "Keep event titles privacy-safe and view matter details only inside Aria."
        ],
    notes: [
      "Calendar events use privacy-safe titles and do not include sensitive visa or document details.",
      "Appointment booking fallback remains available even when no calendar provider is configured."
    ],
    disabledReason: env.provider === "disabled" ? "Calendar provider not configured." : null
  });
}
