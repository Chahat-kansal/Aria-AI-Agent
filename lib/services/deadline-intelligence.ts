export type DeadlineSeverity = "OVERDUE" | "URGENT_48_HOURS" | "DUE_7_DAYS" | "DUE_14_DAYS" | "DUE_30_DAYS" | "WATCH";

export type DeadlineCategory =
  | "VISA_EXPIRY"
  | "CRITICAL_DEADLINE"
  | "REQUEST_RESPONSE"
  | "DOCUMENT_DUE"
  | "LODGEMENT_TARGET"
  | "CLIENT_CONFIRMATION"
  | "APPOINTMENT";

export type MatterDeadlineInput = {
  id: string;
  title: string;
  visaSubclass: string;
  currentVisaExpiry?: Date | null;
  criticalDeadline?: Date | null;
  lodgementTargetDate?: Date | null;
  expectedNextMilestone?: string | null;
  checklistItems?: Array<{
    id: string;
    label: string;
    required: boolean;
    dueDate?: Date | null;
    documentId?: string | null;
  }>;
  documentRequests?: Array<{
    id: string;
    status: string;
    dueDate?: Date | null;
    reminderSentAt?: Date | null;
  }>;
  intakeRequests?: Array<{
    id: string;
    status: string;
    title: string;
    expiresAt?: Date | null;
  }>;
  appointments?: Array<{
    id: string;
    status: string;
    meetingType: string;
    startsAt: Date;
  }>;
};

export type DeadlineItem = {
  id: string;
  category: DeadlineCategory;
  title: string;
  dueAt: Date;
  severity: DeadlineSeverity;
  daysUntil: number;
  verifiedLegalDeadline: false;
  agentVerificationRequired: true;
  source: string;
  recommendedAction: string;
};

export type DeadlineNudge = {
  id: string;
  channel: "email" | "manual";
  title: string;
  message: string;
  sensitiveContentExcluded: true;
};

export type DeadlineIntelligence = {
  disclaimer: string;
  status: "NO_DATES_SET" | "ON_TRACK" | "WATCH" | "ACTION_REQUIRED";
  summary: string;
  deadlines: DeadlineItem[];
  alerts: DeadlineItem[];
  reverseTimeline: Array<{
    id: string;
    title: string;
    targetDate: Date;
    reason: string;
  }>;
  clientNudges: DeadlineNudge[];
  agentAlerts: DeadlineNudge[];
};

export const DEADLINE_REVIEW_DISCLAIMER = "Operational deadline reminder - agent must verify legal deadline.";

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysUntil(date: Date, now = new Date()) {
  const ms = startOfDay(date).getTime() - startOfDay(now).getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function severityFor(date: Date, now: Date): DeadlineSeverity {
  const days = daysUntil(date, now);
  if (days < 0) return "OVERDUE";
  if (days <= 2) return "URGENT_48_HOURS";
  if (days <= 7) return "DUE_7_DAYS";
  if (days <= 14) return "DUE_14_DAYS";
  if (days <= 30) return "DUE_30_DAYS";
  return "WATCH";
}

function addDeadline(input: {
  list: DeadlineItem[];
  now: Date;
  id: string;
  category: DeadlineCategory;
  title: string;
  dueAt?: Date | null;
  source: string;
  recommendedAction: string;
}) {
  if (!input.dueAt) return;
  input.list.push({
    id: input.id,
    category: input.category,
    title: input.title,
    dueAt: input.dueAt,
    severity: severityFor(input.dueAt, input.now),
    daysUntil: daysUntil(input.dueAt, input.now),
    verifiedLegalDeadline: false,
    agentVerificationRequired: true,
    source: input.source,
    recommendedAction: input.recommendedAction
  });
}

function minusDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

function formatShort(date: Date) {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function buildMatterDeadlineIntelligence(input: MatterDeadlineInput, options?: {
  now?: Date;
  emailConfigured?: boolean;
}) : DeadlineIntelligence {
  const now = options?.now ?? new Date();
  const deadlines: DeadlineItem[] = [];

  addDeadline({
    list: deadlines,
    now,
    id: "current-visa-expiry",
    category: "VISA_EXPIRY",
    title: "Current visa expiry",
    dueAt: input.currentVisaExpiry,
    source: "Matter current visa expiry",
    recommendedAction: "Confirm visa expiry, bridging status, and any lawful-status implications before relying on this reminder."
  });

  addDeadline({
    list: deadlines,
    now,
    id: "critical-deadline",
    category: "CRITICAL_DEADLINE",
    title: input.expectedNextMilestone || "Critical matter deadline",
    dueAt: input.criticalDeadline,
    source: "Matter critical deadline",
    recommendedAction: "Verify the legal basis and exact calculation of this deadline before advising or acting."
  });

  addDeadline({
    list: deadlines,
    now,
    id: "lodgement-target",
    category: "LODGEMENT_TARGET",
    title: "Lodgement preparation target",
    dueAt: input.lodgementTargetDate,
    source: "Matter lodgement target date",
    recommendedAction: "Use this as an internal preparation target only. Agent must verify lodgement timing and legal deadline."
  });

  for (const item of input.checklistItems ?? []) {
    if (item.documentId || !item.dueDate) continue;
    addDeadline({
      list: deadlines,
      now,
      id: `checklist-${item.id}`,
      category: "DOCUMENT_DUE",
      title: `Document due: ${item.label}`,
      dueAt: item.dueDate,
      source: item.required ? "Required document checklist" : "Recommended document checklist",
      recommendedAction: `Follow up with the client for ${item.label}. Do not include private document contents in reminders.`
    });
  }

  for (const request of input.documentRequests ?? []) {
    if (request.status === "COMPLETED" || !request.dueDate) continue;
    addDeadline({
      list: deadlines,
      now,
      id: `document-request-${request.id}`,
      category: "REQUEST_RESPONSE",
      title: "Document request due",
      dueAt: request.dueDate,
      source: "Client document request",
      recommendedAction: "Send a minimal reminder with the secure portal link only if configured and rate-limited."
    });
  }

  for (const request of input.intakeRequests ?? []) {
    if (request.status === "REVIEWED" || !request.expiresAt) continue;
    addDeadline({
      list: deadlines,
      now,
      id: `intake-${request.id}`,
      category: "CLIENT_CONFIRMATION",
      title: `Client confirmation due: ${request.title}`,
      dueAt: request.expiresAt,
      source: "Client intake / confirmation request",
      recommendedAction: "Ask the client to complete the secure confirmation link. Health, character, and declaration answers must remain review-required."
    });
  }

  for (const appointment of input.appointments ?? []) {
    if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") continue;
    addDeadline({
      list: deadlines,
      now,
      id: `appointment-${appointment.id}`,
      category: "APPOINTMENT",
      title: `Appointment: ${appointment.meetingType}`,
      dueAt: appointment.startsAt,
      source: "Matter appointment",
      recommendedAction: "Prepare questions, outstanding document list, and review warnings before the appointment."
    });
  }

  const sorted = deadlines.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const alerts = sorted.filter((item) => item.severity !== "WATCH");
  const criticalAlerts = alerts.filter((item) => item.severity === "OVERDUE" || item.severity === "URGENT_48_HOURS" || item.severity === "DUE_7_DAYS");
  const reverseTimeline = input.lodgementTargetDate
    ? [
        {
          id: "docs-ready",
          title: "Documents should be received",
          targetDate: minusDays(input.lodgementTargetDate, 14),
          reason: `To prepare by ${formatShort(input.lodgementTargetDate)}, request evidence at least 14 days earlier where practical.`
        },
        {
          id: "client-confirmations",
          title: "Client confirmations should be returned",
          targetDate: minusDays(input.lodgementTargetDate, 7),
          reason: "Allows time for agent review of declarations, missing fields, and source conflicts."
        },
        {
          id: "agent-final-review",
          title: "Agent final review window",
          targetDate: minusDays(input.lodgementTargetDate, 2),
          reason: "Final check remains review-required and must not be treated as automatic lodgement readiness."
        }
      ]
    : [];

  const outstandingDocuments = sorted.filter((item) => item.category === "DOCUMENT_DUE" || item.category === "REQUEST_RESPONSE");
  const reminderChannel = options?.emailConfigured ? "email" : "manual";
  const clientNudges = outstandingDocuments.slice(0, 5).map<DeadlineNudge>((item) => ({
    id: `nudge-${item.id}`,
    channel: reminderChannel,
    title: `Reminder prepared: ${item.title}`,
    message: options?.emailConfigured
      ? "Send a minimal reminder with the secure portal link. Do not include document contents, passport details, DOBs, or extracted text."
      : "Email/SMS is not configured. Copy a minimal reminder manually and include only the secure portal link.",
    sensitiveContentExcluded: true
  }));
  const agentAlerts = criticalAlerts.slice(0, 5).map<DeadlineNudge>((item) => ({
    id: `agent-alert-${item.id}`,
    channel: options?.emailConfigured ? "email" : "manual",
    title: `Agent alert: ${item.title}`,
    message: `${DEADLINE_REVIEW_DISCLAIMER} Due ${formatShort(item.dueAt)}. ${item.recommendedAction}`,
    sensitiveContentExcluded: true
  }));

  const status: DeadlineIntelligence["status"] = !sorted.length
    ? "NO_DATES_SET"
    : criticalAlerts.length
      ? "ACTION_REQUIRED"
      : alerts.length
        ? "WATCH"
        : "ON_TRACK";

  return {
    disclaimer: DEADLINE_REVIEW_DISCLAIMER,
    status,
    summary: !sorted.length
      ? "No operational deadline dates are set for this matter yet."
      : `${alerts.length} alert(s) inside 30 days. ${criticalAlerts.length} urgent or overdue item(s) need agent verification.`,
    deadlines: sorted,
    alerts,
    reverseTimeline,
    clientNudges,
    agentAlerts
  };
}
