import { getEmailConfigStatus, serverLog } from "@/lib/services/runtime-config";

export type StaffInviteEmailInput = {
  to: string;
  recipientName: string;
  workspaceName: string;
  inviteLink: string;
};

export async function sendStaffInviteEmail(input: StaffInviteEmailInput) {
  const status = getEmailConfigStatus();
  if (!status.configured) {
    serverLog("email.not_configured", { to: input.to, provider: status.provider, missing: status.missing });
    return {
      delivered: false,
      reason: "Email is not configured. Share the invite link with the staff member.",
      inviteLink: input.inviteLink
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
          html: `<p>Hi ${input.recipientName},</p><p>You have been invited to join <strong>${input.workspaceName}</strong> in Aria Migration SaaS.</p><p><a href="${input.inviteLink}">Accept invite and set password</a></p><p>This AI-assisted platform requires migration agent review for all client-facing outputs.</p>`
        })
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        serverLog("email.delivery_failed", { to: input.to, status: response.status, body: body.slice(0, 500) });
        return {
          delivered: false,
          reason: "Email delivery failed. Copy and share the invite link manually.",
          inviteLink: input.inviteLink
        };
      }

      return { delivered: true, reason: "Invite email sent.", inviteLink: input.inviteLink };
    } catch (error) {
      serverLog("email.delivery_error", { to: input.to, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { delivered: false, reason: "Email delivery is unavailable. Copy and share the invite link manually.", inviteLink: input.inviteLink };
}
