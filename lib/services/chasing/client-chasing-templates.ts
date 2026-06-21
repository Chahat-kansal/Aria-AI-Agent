import type { EmailTemplateName } from "@/lib/services/email/templates";
import type { PushTemplateKey } from "@/lib/services/push/push-templates";
import type { SmsTemplateKey } from "@/lib/services/sms/sms-templates";
import type { ClientChaseChannel, ClientChaseSourceType } from "@/lib/services/chasing/client-chasing-policy";

export type ClientChasePreview = {
  sourceType: ClientChaseSourceType;
  channel: ClientChaseChannel;
  label: string;
  subject: string | null;
  body: string;
  route: string | null;
  emailTemplate?: EmailTemplateName | null;
  smsTemplate?: SmsTemplateKey | null;
  pushTemplate?: PushTemplateKey | null;
};

export type ClientChaseTemplateSet = Record<ClientChaseChannel, ClientChasePreview>;

function securePortalIntro(sourceType: ClientChaseSourceType) {
  switch (sourceType) {
    case "missing_documents":
      return "Your migration team has a pending request for you in the secure client portal. Please log in to review.";
    case "pending_confirmation":
      return "Your migration team is waiting for a confirmation in the secure client portal.";
    case "appointment":
      return "Reminder: please check your secure client portal for an upcoming appointment update.";
    case "unpaid_invoice":
      return "Your migration team has a payment reminder waiting in the secure client portal. Please log in to review.";
    case "unread_portal_message":
      return "Reminder: please check your secure client portal for an update.";
    default:
      return "Your migration team has a pending request for you in the secure client portal. Please log in to review.";
  }
}

function labelForSource(sourceType: ClientChaseSourceType) {
  switch (sourceType) {
    case "missing_documents":
      return "Pending document reminder";
    case "pending_confirmation":
      return "Pending confirmation reminder";
    case "appointment":
      return "Appointment reminder";
    case "unpaid_invoice":
      return "Invoice reminder";
    case "unread_portal_message":
      return "Unread portal message reminder";
  }
}

function emailTemplateForSource(sourceType: ClientChaseSourceType): EmailTemplateName {
  switch (sourceType) {
    case "missing_documents":
      return "missing_document_reminder";
    case "pending_confirmation":
      return "client_confirmation_request";
    case "appointment":
      return "appointment_reminder";
    case "unpaid_invoice":
      return "invoice_overdue";
    case "unread_portal_message":
      return "document_request";
  }
}

function smsTemplateForSource(sourceType: ClientChaseSourceType): SmsTemplateKey {
  switch (sourceType) {
    case "missing_documents":
      return "document_reminder";
    case "pending_confirmation":
      return "confirmation_reminder";
    case "appointment":
      return "appointment_reminder";
    case "unpaid_invoice":
      return "invoice_overdue";
    case "unread_portal_message":
      return "message_notification";
  }
}

function pushTemplateForSource(sourceType: ClientChaseSourceType): PushTemplateKey {
  switch (sourceType) {
    case "missing_documents":
      return "portal_action_completed";
    case "pending_confirmation":
      return "portal_action_completed";
    case "appointment":
      return "appointment_reminder";
    case "unpaid_invoice":
      return "invoice_overdue";
    case "unread_portal_message":
      return "message_received";
  }
}

export function buildClientChaseTemplates(input: {
  sourceType: ClientChaseSourceType;
  workspaceName: string;
  portalUrl: string;
}): ClientChaseTemplateSet {
  const intro = securePortalIntro(input.sourceType);
  const label = labelForSource(input.sourceType);
  const emailSubject = `${input.workspaceName}: ${label.toLowerCase()}`;
  const portalBody = `${intro} Open your secure portal to continue.`;

  return {
    portal: {
      sourceType: input.sourceType,
      channel: "portal",
      label,
      subject: null,
      body: intro,
      route: "/client/portal"
    },
    email: {
      sourceType: input.sourceType,
      channel: "email",
      label,
      subject: emailSubject,
      body: `${intro}\n\nSecure portal: ${input.portalUrl}`,
      route: input.portalUrl,
      emailTemplate: emailTemplateForSource(input.sourceType)
    },
    sms: {
      sourceType: input.sourceType,
      channel: "sms",
      label,
      subject: null,
      body: intro,
      route: input.portalUrl,
      smsTemplate: smsTemplateForSource(input.sourceType)
    },
    push: {
      sourceType: input.sourceType,
      channel: "push",
      label,
      subject: "Aria",
      body: portalBody,
      route: "/client/portal",
      pushTemplate: pushTemplateForSource(input.sourceType)
    }
  };
}
