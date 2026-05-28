import { sendEmail } from "@/lib/services/email/send-email";

export type StaffInviteEmailInput = {
  to: string;
  recipientName: string;
  workspaceName: string;
  inviteLink: string;
};

export async function sendStaffInviteEmail(input: StaffInviteEmailInput) {
  const result = await sendEmail({
    to: input.to,
    template: "beta_onboarding",
    templateInput: {
      recipientName: input.recipientName,
      workspaceName: input.workspaceName,
      secureLink: input.inviteLink,
      actionLabel: "Accept invite and set password",
      intro: `You have been invited to join ${input.workspaceName} in Aria.`
    },
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
  const result = await sendEmail({
    to: input.to,
    template: "document_request",
    templateInput: {
      recipientName: input.recipientName,
      workspaceName: input.workspaceName,
      subjectOverride: input.subject,
      intro: input.intro,
      actionLabel: input.actionLabel,
      secureLink: input.actionLink,
      footer: input.footer
    },
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
  const result = await sendEmail({
    to: input.to,
    template: "invoice_issued",
    templateInput: {
      recipientName: input.recipientName,
      workspaceName: input.workspaceName,
      subjectOverride: `Invoice ${input.invoiceNumber} from ${input.workspaceName}`,
      intro: `A review-required invoice ${input.invoiceNumber} has been prepared for ${input.amountLabel}. Due date: ${input.dueDateLabel}.`,
      actionLabel: "Open invoice",
      secureLink: input.invoiceLink,
      footer: "This invoice was prepared in Aria and should be reviewed by your migration team before payment questions are actioned."
    },
    fallbackLink: input.invoiceLink
  });

  return {
    delivered: result.delivered,
    reason: result.reason,
    actionLink: input.invoiceLink
  };
}
