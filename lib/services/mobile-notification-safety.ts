export type NotificationChannel = "in_app" | "email" | "sms" | "push";

export type NotificationSafetyView = {
  channel: NotificationChannel;
  label: string;
  status: "available" | "configured" | "placeholder";
  sensitiveContentAllowed: false;
  messageRule: string;
};

export function buildNotificationSafetyView(config: {
  emailConfigured: boolean;
  smsConfigured?: boolean;
  pushConfigured?: boolean;
}): NotificationSafetyView[] {
  return [
    {
      channel: "in_app",
      label: "In-app notifications",
      status: "available",
      sensitiveContentAllowed: false,
      messageRule: "Show matter-scoped status and task prompts only; never include document contents, raw links, or extracted text."
    },
    {
      channel: "email",
      label: "Email reminders",
      status: config.emailConfigured ? "configured" : "placeholder",
      sensitiveContentAllowed: false,
      messageRule: "Send minimal context and secure portal links only. Do not include passport numbers, DOBs, document text, draft fields, or token hashes."
    },
    {
      channel: "sms",
      label: "SMS reminders",
      status: config.smsConfigured ? "configured" : "placeholder",
      sensitiveContentAllowed: false,
      messageRule: "Use only if a secure SMS provider is configured. Send minimal reminder text and no private client data."
    },
    {
      channel: "push",
      label: "Push notifications",
      status: config.pushConfigured ? "configured" : "placeholder",
      sensitiveContentAllowed: false,
      messageRule: "Use generic wording only and route users back into Aria or the secure portal. Never include private matter data, raw document links, or tokenized URLs in push payloads."
    }
  ];
}

export const mobileExperienceChecklist = [
  "Portal dashboard uses responsive cards and single-column mobile flow.",
  "Document checklist and upload entry points are visible on small screens.",
  "Client confirmations keep review-required wording.",
  "Appointment requests remain token-scoped to one client and matter.",
  "Matter and draft pages should be manually checked on a phone viewport before launch."
];

export function buildMobilePortalGuidance(missingDocumentCount: number) {
  if (missingDocumentCount > 0) {
    return `Mobile upload ready: ${missingDocumentCount} requested document${missingDocumentCount === 1 ? "" : "s"} still need client action. Use clear photos or scans with all corners visible.`;
  }
  return "Mobile portal ready: no outstanding document upload is currently shown for the client.";
}
