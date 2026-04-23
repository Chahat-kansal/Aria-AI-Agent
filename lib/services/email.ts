export type StaffInviteEmailInput = {
  to: string;
  recipientName: string;
  workspaceName: string;
  inviteLink: string;
};

export async function sendStaffInviteEmail(input: StaffInviteEmailInput) {
  if (!process.env.EMAIL_PROVIDER || !process.env.EMAIL_FROM) {
    return {
      delivered: false,
      reason: "Email is not configured. Share the invite link with the staff member.",
      inviteLink: input.inviteLink
    };
  }

  return {
    delivered: false,
    reason: "Email provider adapter is configured for future delivery, but no concrete provider is active in this deployment.",
    inviteLink: input.inviteLink
  };
}
