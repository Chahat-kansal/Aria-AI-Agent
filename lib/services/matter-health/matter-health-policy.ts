import { UserRole, UserStatus, type User } from "@prisma/client";
import { hasPermission } from "@/lib/services/roles";

export type MatterHealthBand = "green" | "amber" | "red";
export type MatterHealthSeverity = "info" | "warning" | "critical";

export const MATTER_HEALTH_AGENT_REVIEW_WARNING = "Agent review required";
export const MATTER_HEALTH_LEGAL_DISCLAIMER = "This is not legal advice.";
export const MATTER_HEALTH_OUTCOME_DISCLAIMER =
  "Matter health is advisory only. It does not predict visa outcomes, provide legal advice, or mark a matter ready to lodge.";

export const MATTER_HEALTH_THRESHOLDS = {
  green: 80,
  amber: 55,
  criticalNotification: 35
} as const;

export const MATTER_HEALTH_SIGNAL_WEIGHTS = {
  overdueDeadlines: 12,
  urgentDeadlines: 6,
  missingRequiredEvidence: 8,
  pendingConfirmation: 6,
  staleClientResponse: 7,
  criticalValidationIssue: 14,
  highValidationIssue: 10,
  mediumValidationIssue: 5,
  lowConfidenceExtraction: 4,
  flaggedDocument: 5,
  overdueTask: 4,
  blockedTask: 6,
  overdueInvoice: 8,
  sentInvoiceDueSoon: 4,
  draftNeedsReview: 7,
  draftNeedsWork: 10,
  acknowledgementReviewRequired: 5
} as const;

type MatterHealthUser = Pick<User, "role" | "status" | "permissionsJson">;

export function canAccessMatterHealth(user: MatterHealthUser) {
  if (user.status !== UserStatus.ACTIVE) return false;
  if (user.role === UserRole.COMPANY_OWNER || user.role === UserRole.COMPANY_ADMIN) return true;
  return (
    hasPermission(user, "can_edit_matters") ||
    hasPermission(user, "can_view_all_matters") ||
    hasPermission(user, "can_send_client_requests") ||
    hasPermission(user, "can_manage_appointments") ||
    hasPermission(user, "can_view_invoices")
  );
}

export function canReceiveMatterHealthNotifications(user: MatterHealthUser) {
  if (!canAccessMatterHealth(user)) return false;
  return hasPermission(user, "can_edit_matters") || hasPermission(user, "can_manage_team") || user.role === UserRole.COMPANY_OWNER;
}

export function matterHealthBand(score: number): MatterHealthBand {
  if (score >= MATTER_HEALTH_THRESHOLDS.green) return "green";
  if (score >= MATTER_HEALTH_THRESHOLDS.amber) return "amber";
  return "red";
}

export function matterHealthBandLabel(band: MatterHealthBand) {
  if (band === "green") return "Stable";
  if (band === "amber") return "Needs attention";
  return "At risk";
}

export function matterHealthTone(band: MatterHealthBand): MatterHealthSeverity {
  if (band === "green") return "info";
  if (band === "amber") return "warning";
  return "critical";
}
