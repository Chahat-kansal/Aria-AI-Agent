import { UserStatus, type User } from "@prisma/client";
import { hasPermission, type PermissionKey } from "@/lib/services/roles";

export const DEADLINE_SAFE_REMINDER =
  "Your migration team has a pending deadline to review in the secure client portal. Please log in to review.";

export const DEADLINE_AGENT_REMINDER =
  "Aria: A matter deadline needs attention. Open Aria to review.";

export const DEADLINE_REVIEW_WARNING =
  "Calculated and suggested deadlines are operational prompts only. Agent review is required before relying on them.";

export type DeadlineCategory =
  | "manual"
  | "critical_deadline"
  | "visa_expiry"
  | "lodgement_target"
  | "missing_evidence"
  | "client_response"
  | "appointment_follow_up"
  | "invoice_follow_up"
  | "review_required";

export type DeadlineUrgency = "overdue" | "urgent" | "upcoming" | "watch";

export type DeadlineChannel = "agent_push" | "portal" | "email";

export type ScopedDeadlineUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

const deadlinePermissions: PermissionKey[] = [
  "can_edit_matters",
  "can_send_client_requests",
  "can_manage_appointments",
  "can_view_invoices"
];

export function canAccessDeadlineCentre(user: ScopedDeadlineUser) {
  if (user.status === UserStatus.DISABLED) return false;
  return deadlinePermissions.some((permission) => hasPermission(user, permission));
}

export function canManageDeadlineRecords(user: ScopedDeadlineUser) {
  if (user.status === UserStatus.DISABLED) return false;
  return hasPermission(user, "can_edit_matters") || hasPermission(user, "can_send_client_requests");
}

export function canSendDeadlineReminder(user: ScopedDeadlineUser) {
  if (user.status === UserStatus.DISABLED) return false;
  return hasPermission(user, "can_send_client_requests") || hasPermission(user, "can_manage_appointments") || hasPermission(user, "can_view_invoices");
}

export function categoryLabel(category: DeadlineCategory) {
  switch (category) {
    case "manual":
      return "Manual";
    case "critical_deadline":
      return "Critical deadline";
    case "visa_expiry":
      return "Visa expiry";
    case "lodgement_target":
      return "Lodgement target";
    case "missing_evidence":
      return "Missing evidence";
    case "client_response":
      return "Client response";
    case "appointment_follow_up":
      return "Appointment";
    case "invoice_follow_up":
      return "Invoice follow-up";
    case "review_required":
      return "Review required";
  }
}

export function urgencyLabel(urgency: DeadlineUrgency) {
  switch (urgency) {
    case "overdue":
      return "Overdue";
    case "urgent":
      return "Urgent";
    case "upcoming":
      return "Upcoming";
    case "watch":
      return "Watch";
  }
}

export function allowedReminderChannels(input: { clientFacing: boolean; clientEmail: string | null; portalAvailable?: boolean }) {
  if (!input.clientFacing) return ["agent_push"] as DeadlineChannel[];

  const channels: DeadlineChannel[] = [];
  if (input.portalAvailable !== false) channels.push("portal");
  if (input.clientEmail) channels.push("email");
  if (!channels.length) channels.push("agent_push");
  return channels;
}
