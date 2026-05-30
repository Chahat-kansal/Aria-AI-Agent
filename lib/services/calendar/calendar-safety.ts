import { redactErrorSummary } from "@/lib/providers/shared";

export type SafeCalendarEventPayload = {
  title: string;
  description: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  calendarId?: string | null;
  location?: string | null;
  meetingMethod?: string | null;
};

const FORBIDDEN_PATTERNS = [
  /passport/i,
  /\bdob\b/i,
  /date of birth/i,
  /grant/i,
  /document/i,
  /health/i,
  /character/i,
  /token/i,
  /storage/i,
  /portal\/[A-Za-z0-9_-]{12,}/i,
  /https?:\/\//i
];

export function buildPrivacySafeCalendarTitle(workspaceName?: string | null) {
  const trimmed = (workspaceName || "").trim();
  return trimmed ? `${trimmed} client appointment` : "Client appointment";
}

export function buildPrivacySafeCalendarDescription(input: {
  workspaceName?: string | null;
  timeLabel: string;
  includeVideoPlaceholder?: boolean;
}) {
  const lines = [
    "Appointment scheduled through Aria.",
    `Time: ${input.timeLabel}`,
    input.workspaceName ? `Firm: ${input.workspaceName}` : null,
    "View details in Aria.",
    input.includeVideoPlaceholder ? "Video meeting link not configured." : null
  ].filter(Boolean);

  return lines.join("\n");
}

export function assertSafeCalendarPayload(payload: SafeCalendarEventPayload) {
  const combined = JSON.stringify(payload);
  return !FORBIDDEN_PATTERNS.some((pattern) => pattern.test(combined));
}

export function sanitizeCalendarError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return redactErrorSummary(message) || "Calendar sync failed.";
}
