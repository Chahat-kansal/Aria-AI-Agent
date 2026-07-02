import { AppointmentStatus, DocumentRequestItemStatus, DocumentRequestStatus, InvoiceStatus, ReviewRequestStatus } from "@prisma/client";
import { categoryLabel, type DeadlineCategory, type DeadlineUrgency } from "@/lib/services/deadlines/deadline-policy";

export type DerivedDeadline = {
  id: string;
  kind: "calculated" | "suggested";
  category: DeadlineCategory;
  title: string;
  safeSummary: string;
  dueAt: Date;
  urgency: DeadlineUrgency;
  daysUntil: number;
  reviewRequired: true;
  clientFacing: boolean;
  clientVisible: boolean;
  sourceLabel: string;
  reminderRoute: string | null;
  relatedSourceType?: string | null;
  relatedSourceId?: string | null;
};

type MatterDeadlineSeed = {
  id: string;
  matterReference: string | null;
  title: string;
  currentVisaExpiry: Date | null;
  criticalDeadline: Date | null;
  lodgementTargetDate: Date | null;
  expectedNextMilestone: string | null;
  client: { id: string };
  checklistItems: Array<{
    id: string;
    label: string;
    required: boolean;
    dueDate: Date | null;
    documentId: string | null;
  }>;
  documentRequests: Array<{
    id: string;
    status: DocumentRequestStatus;
    dueDate: Date | null;
    items: Array<{ id: string; status: DocumentRequestItemStatus }>;
  }>;
  reviewRequests: Array<{
    id: string;
    status: ReviewRequestStatus;
    expiresAt: Date | null;
  }>;
  appointments: Array<{
    id: string;
    status: AppointmentStatus;
    meetingType: string;
    startsAt: Date;
  }>;
  invoices: Array<{
    id: string;
    status: InvoiceStatus;
    dueDate: Date;
    invoiceNumber: string;
  }>;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function calculateDaysUntil(date: Date, now = new Date()) {
  const ms = startOfDay(date).getTime() - startOfDay(now).getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function deriveDeadlineUrgency(date: Date, now = new Date()): DeadlineUrgency {
  const days = calculateDaysUntil(date, now);
  if (days < 0) return "overdue";
  if (days <= 2) return "urgent";
  if (days <= 14) return "upcoming";
  return "watch";
}

function pushDeadline(list: DerivedDeadline[], input: Omit<DerivedDeadline, "urgency" | "daysUntil"> & { now: Date }) {
  const daysUntil = calculateDaysUntil(input.dueAt, input.now);
  list.push({
    ...input,
    daysUntil,
    urgency: deriveDeadlineUrgency(input.dueAt, input.now)
  });
}

export function buildDerivedDeadlinesForMatter(matter: MatterDeadlineSeed, now = new Date()) {
  const deadlines: DerivedDeadline[] = [];

  if (matter.currentVisaExpiry) {
    pushDeadline(deadlines, {
      id: `visa-expiry:${matter.id}`,
      kind: "calculated",
      category: "visa_expiry",
      title: "Current visa expiry",
      safeSummary: "Current visa timing should be reviewed before any client advice or lodgement planning.",
      dueAt: matter.currentVisaExpiry,
      reviewRequired: true,
      clientFacing: false,
      clientVisible: false,
      sourceLabel: "Matter visa expiry",
      reminderRoute: `/app/matters/${matter.id}`,
      relatedSourceType: "matter",
      relatedSourceId: matter.id,
      now
    });
  }

  if (matter.criticalDeadline) {
    pushDeadline(deadlines, {
      id: `critical:${matter.id}`,
      kind: "calculated",
      category: "critical_deadline",
      title: matter.expectedNextMilestone || "Critical matter deadline",
      safeSummary: "Operational deadline reminder. Agent review is required before relying on this date.",
      dueAt: matter.criticalDeadline,
      reviewRequired: true,
      clientFacing: false,
      clientVisible: false,
      sourceLabel: "Matter critical deadline",
      reminderRoute: `/app/matters/${matter.id}`,
      relatedSourceType: "matter",
      relatedSourceId: matter.id,
      now
    });
  }

  if (matter.lodgementTargetDate) {
    pushDeadline(deadlines, {
      id: `lodgement-target:${matter.id}`,
      kind: "suggested",
      category: "lodgement_target",
      title: "Lodgement preparation target",
      safeSummary: "Internal preparation target only. This is not an authoritative legal deadline.",
      dueAt: matter.lodgementTargetDate,
      reviewRequired: true,
      clientFacing: false,
      clientVisible: false,
      sourceLabel: "Matter lodgement target",
      reminderRoute: `/app/matters/${matter.id}`,
      relatedSourceType: "matter",
      relatedSourceId: matter.id,
      now
    });
  }

  for (const item of matter.checklistItems) {
    if (!item.required || item.documentId || !item.dueDate) continue;
    pushDeadline(deadlines, {
      id: `checklist:${item.id}`,
      kind: "suggested",
      category: "missing_evidence",
      title: `Missing evidence: ${item.label}`,
      safeSummary: "Pending evidence reminder. Use secure portal reminders only and avoid sensitive document details.",
      dueAt: item.dueDate,
      reviewRequired: true,
      clientFacing: true,
      clientVisible: true,
      sourceLabel: "Matter checklist",
      reminderRoute: `/client/portal`,
      relatedSourceType: "checklist_item",
      relatedSourceId: item.id,
      now
    });
  }

  for (const request of matter.documentRequests) {
    if (request.status === DocumentRequestStatus.COMPLETED || !request.dueDate) continue;
    const hasOutstanding = request.items.some((item) => item.status === DocumentRequestItemStatus.MISSING || item.status === DocumentRequestItemStatus.REQUESTED);
    if (!hasOutstanding) continue;
    pushDeadline(deadlines, {
      id: `document-request:${request.id}`,
      kind: "suggested",
      category: "missing_evidence",
      title: "Document request follow-up",
      safeSummary: "Your migration team has a pending request for you in the secure client portal. Please log in to review.",
      dueAt: request.dueDate,
      reviewRequired: true,
      clientFacing: true,
      clientVisible: true,
      sourceLabel: "Document request",
      reminderRoute: `/client/portal`,
      relatedSourceType: "document_request",
      relatedSourceId: request.id,
      now
    });
  }

  for (const request of matter.reviewRequests) {
    const pendingReviewStatuses: ReviewRequestStatus[] = [
      ReviewRequestStatus.REVIEW_REQUESTED,
      ReviewRequestStatus.SENT_TO_CLIENT,
      ReviewRequestStatus.VIEWED_BY_CLIENT,
      ReviewRequestStatus.REQUIRES_FOLLOW_UP
    ];
    if (!request.expiresAt || !pendingReviewStatuses.includes(request.status)) {
      continue;
    }
    pushDeadline(deadlines, {
      id: `review-request:${request.id}`,
      kind: "suggested",
      category: "client_response",
      title: "Client confirmation follow-up",
      safeSummary: "Your migration team is waiting for a confirmation in the secure client portal.",
      dueAt: request.expiresAt,
      reviewRequired: true,
      clientFacing: true,
      clientVisible: true,
      sourceLabel: "Review request",
      reminderRoute: `/client/portal`,
      relatedSourceType: "review_request",
      relatedSourceId: request.id,
      now
    });
  }

  for (const appointment of matter.appointments) {
    if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.COMPLETED) continue;
    pushDeadline(deadlines, {
      id: `appointment:${appointment.id}`,
      kind: "suggested",
      category: "appointment_follow_up",
      title: `Appointment: ${appointment.meetingType}`,
      safeSummary: "Upcoming appointment reminder. Share only generic appointment wording outside Aria.",
      dueAt: appointment.startsAt,
      reviewRequired: true,
      clientFacing: true,
      clientVisible: true,
      sourceLabel: "Appointment",
      reminderRoute: `/client/portal`,
      relatedSourceType: "appointment",
      relatedSourceId: appointment.id,
      now
    });
  }

  for (const invoice of matter.invoices) {
    const invoiceStatuses: InvoiceStatus[] = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE];
    if (!invoiceStatuses.includes(invoice.status)) continue;
    pushDeadline(deadlines, {
      id: `invoice:${invoice.id}`,
      kind: "suggested",
      category: "invoice_follow_up",
      title: `Invoice follow-up: ${invoice.invoiceNumber}`,
      safeSummary: "Your migration team has an invoice update in the secure client portal. Please log in to review.",
      dueAt: invoice.dueDate,
      reviewRequired: true,
      clientFacing: true,
      clientVisible: false,
      sourceLabel: "Invoice",
      reminderRoute: `/client/portal`,
      relatedSourceType: "invoice",
      relatedSourceId: invoice.id,
      now
    });
  }

  return deadlines.sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
}

export function summariseDeadlineCategory(category: DeadlineCategory) {
  return `${categoryLabel(category)} deadline`;
}
