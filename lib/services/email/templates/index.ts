export type EmailTemplateName =
  | "client_portal_invite"
  | "client_portal_activation"
  | "document_request"
  | "missing_document_reminder"
  | "client_confirmation_request"
  | "appointment_request_received"
  | "appointment_confirmed"
  | "appointment_reminder"
  | "deadline_reminder"
  | "invoice_issued"
  | "invoice_overdue"
  | "magic_login"
  | "beta_onboarding";

export type EmailTemplateInput = {
  recipientName: string;
  workspaceName: string;
  secureLink?: string;
  intro?: string;
  actionLabel?: string;
  footer?: string;
  subjectOverride?: string;
};

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

function safeFooter(input: EmailTemplateInput) {
  return input.footer || "Aria prepares workflow steps for migration professional review. Ready for agent final review.";
}

function makeActionBlock(label?: string, link?: string) {
  if (!label || !link) return { text: "", html: "" };
  return {
    text: `${label}:\n${link}\n\n`,
    html: `<p><a href="${link}">${label}</a></p>`
  };
}

function buildGenericTemplate(subject: string, intro: string, input: EmailTemplateInput): EmailTemplate {
  const action = makeActionBlock(input.actionLabel || "Open secure portal", input.secureLink);
  const footer = safeFooter(input);
  return {
    subject: input.subjectOverride || subject,
    text: [
      `Hi ${input.recipientName},`,
      "",
      intro,
      action.text.trimEnd(),
      "",
      footer,
      "",
      input.workspaceName
    ].filter(Boolean).join("\n"),
    html: `<p>Hi ${input.recipientName},</p><p>${intro}</p>${action.html}<p>${footer}</p><p><small>${input.workspaceName}</small></p>`
  };
}

export function buildEmailTemplate(name: EmailTemplateName, input: EmailTemplateInput): EmailTemplate {
  switch (name) {
    case "client_portal_invite":
      return buildGenericTemplate("Your secure Aria client portal invite", input.intro || "Your migration team has invited you to your secure client portal.", input);
    case "client_portal_activation":
      return buildGenericTemplate("Activate your Aria client portal", input.intro || "Activate your secure client portal to review requests, upload documents, and confirm your details.", input);
    case "document_request":
      return buildGenericTemplate("Document request from your migration team", input.intro || "Your migration team has requested documents in your secure portal.", input);
    case "missing_document_reminder":
      return buildGenericTemplate("Reminder: documents still needed", input.intro || "You still have pending document requests in your secure portal.", input);
    case "client_confirmation_request":
      return buildGenericTemplate("Confirmation requested in your secure portal", input.intro || "Please review and confirm the requested details in your secure portal.", input);
    case "appointment_request_received":
      return buildGenericTemplate("Appointment request received", input.intro || "Your migration team has received your appointment request.", input);
    case "appointment_confirmed":
      return buildGenericTemplate("Your appointment is confirmed", input.intro || "Your appointment details are ready in your secure portal.", input);
    case "appointment_reminder":
      return buildGenericTemplate("Appointment reminder", input.intro || "You have an upcoming appointment. Please review the details in your secure portal.", input);
    case "deadline_reminder":
      return buildGenericTemplate("Operational deadline reminder", input.intro || "An upcoming operational deadline needs agent review.", input);
    case "invoice_issued":
      return buildGenericTemplate("Invoice issued", input.intro || "A review-required invoice is available in your secure portal.", input);
    case "invoice_overdue":
      return buildGenericTemplate("Invoice overdue reminder", input.intro || "A review-required invoice remains outstanding in your secure portal.", input);
    case "magic_login":
      return buildGenericTemplate("Your secure sign-in link", input.intro || "Use this secure sign-in link to access your portal.", input);
    case "beta_onboarding":
      return buildGenericTemplate("Welcome to the Aria beta", input.intro || "Thanks for joining the controlled beta. We will guide your workspace setup carefully.", input);
    default:
      return buildGenericTemplate("Aria secure notification", input.intro || "A secure Aria workflow update is ready for your review.", input);
  }
}
