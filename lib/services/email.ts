import { getEmailConfigStatus, serverLog } from "@/lib/services/runtime-config";

export type StaffInviteEmailInput = {
  to: string;
  recipientName: string;
  workspaceName: string;
  inviteLink: string;
};

type WorkflowEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  fallbackLink?: string;
};

async function sendWorkflowEmail(input: WorkflowEmailInput) {
  const status = getEmailConfigStatus();
  if (!status.configured) {
    serverLog("email.not_configured", { to: input.to, provider: status.provider, missing: status.missing });
    return {
      delivered: false,
      reason: "Email is not configured. Share the secure link manually.",
      link: input.fallbackLink
    };
  }

  if (status.provider === "resend") {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html
        })
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        serverLog("email.delivery_failed", { to: input.to, status: response.status, body: body.slice(0, 500) });
        return {
          delivered: false,
          reason: "Email delivery failed. Copy and share the secure link manually.",
          link: input.fallbackLink
        };
      }

      return { delivered: true, reason: "Email sent.", link: input.fallbackLink };
    } catch (error) {
      serverLog("email.delivery_error", { to: input.to, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { delivered: false, reason: "Email delivery is unavailable. Copy and share the secure link manually.", link: input.fallbackLink };
}

export async function sendStaffInviteEmail(input: StaffInviteEmailInput) {
  const result = await sendWorkflowEmail({
    to: input.to,
    subject: `You have been invited to ${input.workspaceName}`,
    text: [
      `Hi ${input.recipientName},`,
      "",
      `You have been invited to join ${input.workspaceName} in Aria Migration SaaS.`,
      "Set your password using this secure invite link:",
      input.inviteLink,
      "",
      "This AI-assisted platform requires migration agent review for all client-facing outputs."
    ].join("\n"),
    html: `<p>Hi ${input.recipientName},</p><p>You have been invited to join <strong>${input.workspaceName}</strong> in Aria Migration SaaS.</p><p><a href="${input.inviteLink}">Accept invite and set password</a></p><p>This AI-assisted platform requires migration agent review for all client-facing outputs.</p>`,
    fallbackLink: input.inviteLink
  });

  return {
    delivered: result.delivered,
    reason: result.delivered ? "Invite email sent." : result.reason,
    inviteLink: input.inviteLink
  };
}

export async function sendClientWorkflowEmail(input: {
  to: string;
  recipientName: string;
  workspaceName: string;
  subject: string;
  intro: string;
  actionLabel: string;
  actionLink: string;
  footer?: string;
}) {
  const text = [
    `Hi ${input.recipientName},`,
    "",
    input.intro,
    `${input.actionLabel}:`,
    input.actionLink,
    "",
    input.footer || "This AI-assisted workflow is prepared for registered migration agent review."
  ].join("\n");

  const html = `<p>Hi ${input.recipientName},</p><p>${input.intro}</p><p><a href="${input.actionLink}">${input.actionLabel}</a></p><p>${input.footer || "This AI-assisted workflow is prepared for registered migration agent review."}</p><p><small>${input.workspaceName}</small></p>`;

  const result = await sendWorkflowEmail({
    to: input.to,
    subject: input.subject,
    text,
    html,
    fallbackLink: input.actionLink
  });

  return {
    delivered: result.delivered,
    reason: result.reason,
    actionLink: input.actionLink
  };
}

export async function sendInvoiceEmail(input: {
  to: string;
  recipientName: string;
  workspaceName: string;
  invoiceNumber: string;
  amountLabel: string;
  dueDateLabel: string;
  invoiceLink: string;
}) {
  const text = [
    `Hi ${input.recipientName},`,
    "",
    `A review-required invoice ${input.invoiceNumber} has been prepared for ${input.amountLabel}.`,
    `Due date: ${input.dueDateLabel}`,
    "",
    "Open the invoice using this secure link:",
    input.invoiceLink,
    "",
    "This invoice was prepared in Aria and should be reviewed by your migration team before payment questions are actioned."
  ].join("\n");

  const html = `<p>Hi ${input.recipientName},</p><p>A review-required invoice <strong>${input.invoiceNumber}</strong> has been prepared for <strong>${input.amountLabel}</strong>.</p><p>Due date: ${input.dueDateLabel}</p><p><a href="${input.invoiceLink}">Open invoice</a></p><p>This invoice was prepared in Aria and should be reviewed by your migration team before payment questions are actioned.</p><p><small>${input.workspaceName}</small></p>`;

  const result = await sendWorkflowEmail({
    to: input.to,
    subject: `Invoice ${input.invoiceNumber} from ${input.workspaceName}`,
    text,
    html,
    fallbackLink: input.invoiceLink
  });

  return {
    delivered: result.delivered,
    reason: result.reason,
    actionLink: input.invoiceLink
  };
}
