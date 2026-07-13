import {
  AcknowledgementReviewStatus,
  AppointmentStatus,
  DeadlineStatus,
  DocumentRequestItemStatus,
  DocumentRequestStatus,
  DraftStatus,
  InvoiceStatus,
  ResolutionStatus,
  ReviewRequestStatus,
  TaskStatus,
  Prisma
} from "@prisma/client";
import { buildDerivedDeadlinesForMatter, type DerivedDeadline } from "@/lib/services/deadlines/deadline-calculator";
import {
  MATTER_HEALTH_SIGNAL_WEIGHTS,
  type MatterHealthSeverity
} from "@/lib/services/matter-health/matter-health-policy";

export const matterHealthMatterInclude = Prisma.validator<Prisma.MatterInclude>()({
  client: true,
  assignedToUser: { select: { id: true, name: true, email: true, role: true, status: true, visibilityScope: true, permissionsJson: true } },
  deadlines: { where: { status: DeadlineStatus.OPEN }, orderBy: { dueAt: "asc" } },
  documents: { select: { id: true, reviewStatus: true, extractionStatus: true } },
  extractedFields: { select: { id: true, confidence: true, needsReview: true, status: true } },
  validationIssues: {
    where: { resolutionStatus: { in: [ResolutionStatus.OPEN, ResolutionStatus.IN_PROGRESS] } },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }]
  },
  checklistItems: { orderBy: [{ required: "desc" }, { label: "asc" }] },
  tasks: { where: { status: { not: TaskStatus.DONE } }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] },
  reviewRequests: { orderBy: { createdAt: "desc" }, take: 5 },
  acknowledgementResponses: { orderBy: { submittedAt: "desc" }, take: 5 },
  documentRequests: { include: { items: true }, orderBy: { createdAt: "desc" }, take: 5 },
  appointments: { orderBy: { startsAt: "asc" }, take: 5 },
  applicationDrafts: { orderBy: { updatedAt: "desc" }, take: 3 },
  invoices: { orderBy: { dueDate: "asc" }, take: 5 },
  impacts: { where: { status: { in: ["NEW", "REVIEWING"] as any[] } }, orderBy: { createdAt: "desc" }, take: 5 }
});

export type MatterHealthLoadedMatter = Prisma.MatterGetPayload<{
  include: typeof matterHealthMatterInclude;
}>;

export type MatterHealthSignal = {
  code: string;
  label: string;
  detail: string;
  severity: MatterHealthSeverity;
  impact: number;
  count: number;
  category: "blocker" | "missing_evidence" | "overdue_action" | "client_response" | "review_required" | "finance";
  reviewRequired: true;
  route: string | null;
};

function addSignal(list: MatterHealthSignal[], signal: MatterHealthSignal | null) {
  if (signal && signal.count > 0) list.push(signal);
}

function daysUntil(value: Date | null | undefined) {
  if (!value) return null;
  return Math.ceil((value.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function openReviewRequestCount(matter: MatterHealthLoadedMatter) {
  const openStatuses: ReviewRequestStatus[] = [
    ReviewRequestStatus.REVIEW_REQUESTED,
    ReviewRequestStatus.SENT_TO_CLIENT,
    ReviewRequestStatus.VIEWED_BY_CLIENT,
    ReviewRequestStatus.REQUIRES_FOLLOW_UP
  ];
  return matter.reviewRequests.filter((request) =>
    openStatuses.includes(request.status)
  ).length;
}

function overdueDeadlineCount(manualDeadlines: MatterHealthLoadedMatter["deadlines"], derivedDeadlines: DerivedDeadline[]) {
  const manual = manualDeadlines.filter((deadline) => deadline.dueAt.getTime() < Date.now()).length;
  const derived = derivedDeadlines.filter((deadline) => deadline.urgency === "overdue").length;
  return manual + derived;
}

function urgentDeadlineCount(manualDeadlines: MatterHealthLoadedMatter["deadlines"], derivedDeadlines: DerivedDeadline[]) {
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const manual = manualDeadlines.filter((deadline) => {
    const delta = deadline.dueAt.getTime() - Date.now();
    return delta >= 0 && delta <= twoDaysMs;
  }).length;
  const derived = derivedDeadlines.filter((deadline) => deadline.urgency === "urgent").length;
  return manual + derived;
}

export function buildMatterHealthSignals(matter: MatterHealthLoadedMatter) {
  const derivedDeadlines = buildDerivedDeadlinesForMatter(matter);
  const overdueDeadlines = overdueDeadlineCount(matter.deadlines, derivedDeadlines);
  const urgentDeadlines = urgentDeadlineCount(matter.deadlines, derivedDeadlines);
  const missingEvidence = matter.checklistItems.filter((item) => item.required && !item.documentId).length;
  const pendingConfirmations = openReviewRequestCount(matter);
  const staleDocumentRequests = matter.documentRequests.filter((request) => {
    if (!request.dueDate) return false;
    if (request.status === DocumentRequestStatus.COMPLETED) return false;
    return request.dueDate.getTime() < Date.now();
  }).length;
  const staleReviewRequests = matter.reviewRequests.filter((request) => {
    if (!request.expiresAt) return false;
    const openStatuses: ReviewRequestStatus[] = [
      ReviewRequestStatus.REVIEW_REQUESTED,
      ReviewRequestStatus.SENT_TO_CLIENT,
      ReviewRequestStatus.VIEWED_BY_CLIENT,
      ReviewRequestStatus.REQUIRES_FOLLOW_UP
    ];
    return openStatuses.includes(request.status) && request.expiresAt.getTime() < Date.now();
  }).length;
  const clientResponseLag = staleDocumentRequests + staleReviewRequests;
  const criticalIssues = matter.validationIssues.filter((issue) => issue.severity === "CRITICAL").length;
  const highIssues = matter.validationIssues.filter((issue) => issue.severity === "HIGH").length;
  const mediumIssues = matter.validationIssues.filter((issue) => issue.severity === "MEDIUM").length;
  const lowConfidenceExtraction = matter.extractedFields.filter((field) => field.needsReview || field.confidence < 0.65).length;
  const flaggedDocuments = matter.documents.filter((document) => document.reviewStatus === "FLAGGED").length;
  const overdueTasks = matter.tasks.filter((task) => task.dueDate && task.dueDate.getTime() < Date.now()).length;
  const blockedTasks = matter.tasks.filter((task) => task.status === TaskStatus.BLOCKED).length;
  const overdueInvoices = matter.invoices.filter((invoice) => invoice.status === InvoiceStatus.OVERDUE).length;
  const invoiceDueSoon = matter.invoices.filter((invoice) => invoice.status === InvoiceStatus.SENT && (daysUntil(invoice.dueDate) ?? 999) <= 3).length;
  const latestDraft = matter.applicationDrafts[0] || null;
  const draftReviewStatuses: DraftStatus[] = [
    DraftStatus.DRAFTING,
    DraftStatus.READY_FOR_AGENT_REVIEW,
    DraftStatus.READY_FOR_CLIENT_REVIEW,
    DraftStatus.SENT_TO_CLIENT,
    DraftStatus.RETURNED_TO_AGENT
  ];
  const draftNeedsReview = latestDraft && draftReviewStatuses.includes(latestDraft.status) ? 1 : 0;
  const draftNeedsWork = latestDraft?.status === DraftStatus.NEEDS_WORK ? 1 : 0;
  const acknowledgementReviewRequired = matter.acknowledgementResponses.filter((response) => response.reviewStatus === AcknowledgementReviewStatus.AGENT_REVIEW_REQUIRED).length;

  const signals: MatterHealthSignal[] = [];
  addSignal(signals, overdueDeadlines ? {
    code: "overdue_deadlines",
    label: "Overdue deadlines",
    detail: `${overdueDeadlines} operational deadline(s) are overdue and need agent review.`,
    severity: "critical",
    impact: overdueDeadlines * MATTER_HEALTH_SIGNAL_WEIGHTS.overdueDeadlines,
    count: overdueDeadlines,
    category: "overdue_action",
    reviewRequired: true,
    route: `/app/matters/${matter.id}`
  } : null);
  addSignal(signals, urgentDeadlines ? {
    code: "urgent_deadlines",
    label: "Urgent deadlines",
    detail: `${urgentDeadlines} deadline(s) fall in the next two days.`,
    severity: "warning",
    impact: urgentDeadlines * MATTER_HEALTH_SIGNAL_WEIGHTS.urgentDeadlines,
    count: urgentDeadlines,
    category: "overdue_action",
    reviewRequired: true,
    route: `/app/deadlines?matterId=${matter.id}`
  } : null);
  addSignal(signals, missingEvidence ? {
    code: "missing_required_evidence",
    label: "Missing required evidence",
    detail: `${missingEvidence} required checklist item(s) still have no linked evidence.`,
    severity: missingEvidence >= 3 ? "critical" : "warning",
    impact: missingEvidence * MATTER_HEALTH_SIGNAL_WEIGHTS.missingRequiredEvidence,
    count: missingEvidence,
    category: "missing_evidence",
    reviewRequired: true,
    route: `/app/matters/${matter.id}/checklist`
  } : null);
  addSignal(signals, pendingConfirmations ? {
    code: "pending_confirmations",
    label: "Pending confirmations",
    detail: `${pendingConfirmations} client confirmation item(s) remain open in the secure portal.`,
    severity: "warning",
    impact: pendingConfirmations * MATTER_HEALTH_SIGNAL_WEIGHTS.pendingConfirmation,
    count: pendingConfirmations,
    category: "client_response",
    reviewRequired: true,
    route: `/app/matters/${matter.id}`
  } : null);
  addSignal(signals, clientResponseLag ? {
    code: "client_response_lag",
    label: "Client response overdue",
    detail: `${clientResponseLag} client-facing request(s) are past their due or expiry timing.`,
    severity: "critical",
    impact: clientResponseLag * MATTER_HEALTH_SIGNAL_WEIGHTS.staleClientResponse,
    count: clientResponseLag,
    category: "client_response",
    reviewRequired: true,
    route: `/app/chasing`
  } : null);
  addSignal(signals, criticalIssues ? {
    code: "critical_validation_issues",
    label: "Critical review blockers",
    detail: `${criticalIssues} critical validation issue(s) remain unresolved.`,
    severity: "critical",
    impact: criticalIssues * MATTER_HEALTH_SIGNAL_WEIGHTS.criticalValidationIssue,
    count: criticalIssues,
    category: "blocker",
    reviewRequired: true,
    route: `/app/matters/${matter.id}/review`
  } : null);
  addSignal(signals, highIssues ? {
    code: "high_validation_issues",
    label: "High-priority review blockers",
    detail: `${highIssues} high-priority validation issue(s) remain unresolved.`,
    severity: "warning",
    impact: highIssues * MATTER_HEALTH_SIGNAL_WEIGHTS.highValidationIssue,
    count: highIssues,
    category: "blocker",
    reviewRequired: true,
    route: `/app/matters/${matter.id}/review`
  } : null);
  addSignal(signals, mediumIssues ? {
    code: "medium_validation_issues",
    label: "Review issues",
    detail: `${mediumIssues} medium-priority validation issue(s) remain unresolved.`,
    severity: "warning",
    impact: mediumIssues * MATTER_HEALTH_SIGNAL_WEIGHTS.mediumValidationIssue,
    count: mediumIssues,
    category: "review_required",
    reviewRequired: true,
    route: `/app/matters/${matter.id}/review`
  } : null);
  addSignal(signals, lowConfidenceExtraction ? {
    code: "low_confidence_extraction",
    label: "Low-confidence extraction",
    detail: `${lowConfidenceExtraction} extracted field(s) remain low-confidence or review-required.`,
    severity: "warning",
    impact: lowConfidenceExtraction * MATTER_HEALTH_SIGNAL_WEIGHTS.lowConfidenceExtraction,
    count: lowConfidenceExtraction,
    category: "review_required",
    reviewRequired: true,
    route: `/app/matters/${matter.id}/review`
  } : null);
  addSignal(signals, flaggedDocuments ? {
    code: "flagged_documents",
    label: "Flagged documents",
    detail: `${flaggedDocuments} uploaded document(s) are flagged for additional review.`,
    severity: "warning",
    impact: flaggedDocuments * MATTER_HEALTH_SIGNAL_WEIGHTS.flaggedDocument,
    count: flaggedDocuments,
    category: "review_required",
    reviewRequired: true,
    route: `/app/documents?matterId=${matter.id}`
  } : null);
  addSignal(signals, overdueTasks ? {
    code: "overdue_tasks",
    label: "Overdue actions",
    detail: `${overdueTasks} internal task(s) are overdue.`,
    severity: "warning",
    impact: overdueTasks * MATTER_HEALTH_SIGNAL_WEIGHTS.overdueTask,
    count: overdueTasks,
    category: "overdue_action",
    reviewRequired: true,
    route: `/app/tasks`
  } : null);
  addSignal(signals, blockedTasks ? {
    code: "blocked_tasks",
    label: "Blocked tasks",
    detail: `${blockedTasks} task(s) are blocked and need intervention.`,
    severity: "warning",
    impact: blockedTasks * MATTER_HEALTH_SIGNAL_WEIGHTS.blockedTask,
    count: blockedTasks,
    category: "blocker",
    reviewRequired: true,
    route: `/app/tasks`
  } : null);
  addSignal(signals, overdueInvoices ? {
    code: "overdue_invoices",
    label: "Overdue invoice follow-up",
    detail: `${overdueInvoices} invoice(s) are overdue and may block progress.`,
    severity: "warning",
    impact: overdueInvoices * MATTER_HEALTH_SIGNAL_WEIGHTS.overdueInvoice,
    count: overdueInvoices,
    category: "finance",
    reviewRequired: true,
    route: `/app/invoices`
  } : null);
  addSignal(signals, invoiceDueSoon ? {
    code: "invoice_due_soon",
    label: "Invoice due soon",
    detail: `${invoiceDueSoon} invoice(s) are due within three days.`,
    severity: "info",
    impact: invoiceDueSoon * MATTER_HEALTH_SIGNAL_WEIGHTS.sentInvoiceDueSoon,
    count: invoiceDueSoon,
    category: "finance",
    reviewRequired: true,
    route: `/app/invoices`
  } : null);
  addSignal(signals, draftNeedsReview ? {
    code: "draft_review_required",
    label: "Draft review required",
    detail: "The latest draft remains review-required before it should be relied upon.",
    severity: "warning",
    impact: draftNeedsReview * MATTER_HEALTH_SIGNAL_WEIGHTS.draftNeedsReview,
    count: draftNeedsReview,
    category: "review_required",
    reviewRequired: true,
    route: `/app/matters/${matter.id}/draft`
  } : null);
  addSignal(signals, draftNeedsWork ? {
    code: "draft_needs_work",
    label: "Draft needs rework",
    detail: "The latest draft was returned for more work and should be reviewed before client use.",
    severity: "critical",
    impact: draftNeedsWork * MATTER_HEALTH_SIGNAL_WEIGHTS.draftNeedsWork,
    count: draftNeedsWork,
    category: "blocker",
    reviewRequired: true,
    route: `/app/matters/${matter.id}/draft`
  } : null);
  addSignal(signals, acknowledgementReviewRequired ? {
    code: "acknowledgement_review_required",
    label: "Client acknowledgement review required",
    detail: `${acknowledgementReviewRequired} acknowledgement response(s) need agent review before use.`,
    severity: "warning",
    impact: acknowledgementReviewRequired * MATTER_HEALTH_SIGNAL_WEIGHTS.acknowledgementReviewRequired,
    count: acknowledgementReviewRequired,
    category: "review_required",
    reviewRequired: true,
    route: `/app/matters/${matter.id}`
  } : null);

  const totalPenalty = signals.reduce((total, signal) => total + signal.impact, 0);
  return {
    derivedDeadlines,
    signals,
    totalPenalty,
    counts: {
      overdueDeadlines,
      urgentDeadlines,
      missingEvidence,
      pendingConfirmations,
      clientResponseLag,
      criticalIssues,
      highIssues,
      lowConfidenceExtraction,
      flaggedDocuments,
      overdueTasks,
      blockedTasks,
      overdueInvoices,
      draftNeedsReview,
      acknowledgementReviewRequired
    }
  };
}
