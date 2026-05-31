import { assertSafePushRoute, assertSafePushText } from "@/lib/services/push/push-safety";

export type PushTemplateKey =
  | "portal_action_completed"
  | "document_uploaded"
  | "message_received"
  | "appointment_requested"
  | "appointment_reminder"
  | "deadline_agent_alert"
  | "draft_ready"
  | "invoice_overdue"
  | "integration_failure";

export type PushTemplateInput = {
  appName?: string;
  firmName?: string;
  safeDueTiming?: string | null;
  route?: string | null;
};

const DEFAULT_APP_NAME = "Aria";

const templates: Record<PushTemplateKey, { label: string; title: string; body: (input: PushTemplateInput) => string; route: string | null }> = {
  portal_action_completed: {
    label: "Portal action completed",
    title: "Aria",
    body: () => "Aria: A client completed a portal action. Open Aria to review.",
    route: "/app/overview"
  },
  document_uploaded: {
    label: "Document uploaded",
    title: "Aria",
    body: () => "Aria: A client uploaded a document. Open Aria to review.",
    route: "/app/overview"
  },
  message_received: {
    label: "Message received",
    title: "Aria",
    body: () => "Aria: You have a new message. Open Aria to review.",
    route: "/app/overview"
  },
  appointment_requested: {
    label: "Appointment requested",
    title: "Aria",
    body: () => "Aria: A client requested an appointment. Open Aria to review.",
    route: "/app/appointments"
  },
  appointment_reminder: {
    label: "Appointment reminder",
    title: "Aria",
    body: () => "Aria: You have an upcoming appointment. Open Aria for details.",
    route: "/app/appointments"
  },
  deadline_agent_alert: {
    label: "Deadline alert",
    title: "Aria alert",
    body: (input) => `Aria alert: A matter needs attention ${input.safeDueTiming || "soon"}. Open Aria to review.`,
    route: "/app/overview"
  },
  draft_ready: {
    label: "Draft ready",
    title: "Aria",
    body: () => "Aria: A draft is ready for agent final review.",
    route: "/app/application-drafts"
  },
  invoice_overdue: {
    label: "Invoice overdue",
    title: "Aria",
    body: () => "Aria: An invoice needs attention. Open Aria to review.",
    route: "/app/invoices"
  },
  integration_failure: {
    label: "Integration failure",
    title: "Aria",
    body: () => "Aria: A provider needs attention. Open Aria to review.",
    route: "/app/settings/integrations"
  }
};

export function buildPushTemplate(key: PushTemplateKey, input: PushTemplateInput = {}) {
  const template = templates[key];
  return {
    title: assertSafePushText(template.title || input.appName || DEFAULT_APP_NAME),
    body: assertSafePushText(template.body(input)),
    route: assertSafePushRoute(input.route || template.route),
    label: template.label
  };
}

export function getPushTemplatePreview(key: PushTemplateKey) {
  return buildPushTemplate(key, { appName: DEFAULT_APP_NAME, firmName: "BrightPath Migration", safeDueTiming: "soon" });
}
