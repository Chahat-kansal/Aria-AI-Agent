import { assertSafeSmsBody, buildSafePortalLoginUrl, isSafeSmsUrl } from "@/lib/services/sms/sms-safety";

export type SmsTemplateKey =
  | "portal_request"
  | "document_reminder"
  | "confirmation_reminder"
  | "appointment_reminder"
  | "deadline_agent_alert"
  | "message_notification"
  | "invoice_overdue";

export type SmsTemplateInput = {
  firmName: string;
  portalUrl?: string | null;
  appointmentTimeLabel?: string | null;
  agentFirstName?: string | null;
};

type TemplateDefinition = {
  label: string;
  build(input: SmsTemplateInput): string;
};

const SMS_TEMPLATES: Record<SmsTemplateKey, TemplateDefinition> = {
  portal_request: {
    label: "Portal request",
    build: ({ firmName, portalUrl }) => `${firmName}: You have a pending request in your secure client portal. Please log in to review.${portalUrl && isSafeSmsUrl(portalUrl) ? ` ${portalUrl}` : ""}`
  },
  document_reminder: {
    label: "Document reminder",
    build: ({ firmName, portalUrl }) => `${firmName}: A document request is waiting in your secure client portal. Please log in to upload it.${portalUrl && isSafeSmsUrl(portalUrl) ? ` ${portalUrl}` : ""}`
  },
  confirmation_reminder: {
    label: "Confirmation reminder",
    build: ({ firmName, portalUrl }) => `${firmName}: Please log in to your secure client portal to review a pending confirmation.${portalUrl && isSafeSmsUrl(portalUrl) ? ` ${portalUrl}` : ""}`
  },
  appointment_reminder: {
    label: "Appointment reminder",
    build: ({ firmName, portalUrl, appointmentTimeLabel }) => `${firmName}: Reminder, you have an upcoming appointment${appointmentTimeLabel ? ` at ${appointmentTimeLabel}` : ""} with your migration team. Please check your secure portal for details.${portalUrl && isSafeSmsUrl(portalUrl) ? ` ${portalUrl}` : ""}`
  },
  deadline_agent_alert: {
    label: "Deadline alert",
    build: () => "Aria alert: A matter needs your attention soon. Open Aria to review the deadline details."
  },
  message_notification: {
    label: "Message notification",
    build: ({ firmName, portalUrl }) => `${firmName}: Your migration team sent you a message in your secure portal.${portalUrl && isSafeSmsUrl(portalUrl) ? ` ${portalUrl}` : ""}`
  },
  invoice_overdue: {
    label: "Invoice overdue",
    build: ({ firmName, portalUrl }) => `${firmName}: You have an outstanding invoice reminder in your secure portal. Please log in to review.${portalUrl && isSafeSmsUrl(portalUrl) ? ` ${portalUrl}` : ""}`
  }
};

export function getSmsTemplateCatalog() {
  return Object.entries(SMS_TEMPLATES).map(([key, value]) => ({ key: key as SmsTemplateKey, label: value.label }));
}

export function buildSmsTemplate(key: SmsTemplateKey, input: SmsTemplateInput) {
  const template = SMS_TEMPLATES[key];
  const body = template.build({
    firmName: input.firmName || "Aria",
    portalUrl: input.portalUrl || buildSafePortalLoginUrl(),
    appointmentTimeLabel: input.appointmentTimeLabel || null,
    agentFirstName: input.agentFirstName || null
  });
  return assertSafeSmsBody(body);
}

export function getSmsTemplatePreview(key: SmsTemplateKey, input?: Partial<SmsTemplateInput>) {
  return buildSmsTemplate(key, {
    firmName: input?.firmName || "BrightPath Migration",
    portalUrl: input?.portalUrl || buildSafePortalLoginUrl(),
    appointmentTimeLabel: input?.appointmentTimeLabel || "Tue 04 Jun 10:30",
    agentFirstName: input?.agentFirstName || "Sam"
  });
}
