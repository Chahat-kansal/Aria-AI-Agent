import { resolveBaseUrl } from "@/lib/services/runtime-config";
import type { EmailSyncSendPayload, EmailThreadImportPreview, EmailThreadMetadata } from "@/lib/providers/email-sync-provider";
import { minimizeBodyPreview, sanitizeMessageMetadata } from "@/lib/services/email-sync/email-sync-redaction";

export type EmailSyncTemplateKey =
  | "document_request"
  | "confirmation_request"
  | "appointment_reminder"
  | "portal_invite_reminder"
  | "general_follow_up";

export type EmailSyncTemplateInput = {
  workspaceName: string;
  recipientName: string;
  securePortalLink?: string | null;
};

const sensitivePatterns = [
  /\bpassport\b/i,
  /\bdate of birth\b/i,
  /\bdob\b/i,
  /\bgrant number\b/i,
  /\bgrant\b/i,
  /\bcharacter\b/i,
  /\bhealth\b/i,
  /\btokenhash\b/i,
  /\btoken hash\b/i,
  /\/client\/activate\//i,
  /\/client\/portal\/[A-Za-z0-9_-]{10,}/i,
  /\/api\/documents\//i,
  /\/api\/generated-documents\//i,
  /\/api\/forms\/drafts\//i
];

export function buildSecurePortalLoginLink(requestOrigin?: string | null) {
  const base = resolveBaseUrl({ requestOrigin });
  return base ? `${base}/client/login` : "/client/login";
}

export function buildEmailSyncTemplate(template: EmailSyncTemplateKey, input: EmailSyncTemplateInput): EmailSyncSendPayload {
  const securePortalLink = input.securePortalLink || buildSecurePortalLoginLink();
  const greeting = `Hello ${input.recipientName},`;
  const workspaceName = input.workspaceName;

  switch (template) {
    case "document_request":
      return {
        to: "",
        subject: `${workspaceName}: secure portal document request`,
        bodyText: `${greeting}\n\nPlease log in to your secure client portal to review your pending document request.\n\nSecure portal: ${securePortalLink}\n\nRegards,\n${workspaceName}`,
        securePortalLink,
        templateKey: template
      };
    case "confirmation_request":
      return {
        to: "",
        subject: `${workspaceName}: secure portal confirmation request`,
        bodyText: `${greeting}\n\nYour migration team has sent you a request in your secure portal. Please log in to review and confirm the next steps.\n\nSecure portal: ${securePortalLink}\n\nRegards,\n${workspaceName}`,
        securePortalLink,
        templateKey: template
      };
    case "appointment_reminder":
      return {
        to: "",
        subject: `${workspaceName}: appointment reminder`,
        bodyText: `${greeting}\n\nPlease book or confirm your appointment through your secure portal.\n\nSecure portal: ${securePortalLink}\n\nRegards,\n${workspaceName}`,
        securePortalLink,
        templateKey: template
      };
    case "portal_invite_reminder":
      return {
        to: "",
        subject: `${workspaceName}: secure portal sign-in reminder`,
        bodyText: `${greeting}\n\nPlease use your secure portal to review the latest request from your migration team.\n\nSecure portal: ${securePortalLink}\n\nRegards,\n${workspaceName}`,
        securePortalLink,
        templateKey: template
      };
    case "general_follow_up":
    default:
      return {
        to: "",
        subject: `${workspaceName}: secure portal follow-up`,
        bodyText: `${greeting}\n\nYour migration team has sent you a request in your secure portal.\n\nSecure portal: ${securePortalLink}\n\nRegards,\n${workspaceName}`,
        securePortalLink,
        templateKey: template
      };
  }
}

export function findSensitiveEmailSignals(input: { subject: string; bodyText: string }) {
  const combined = `${input.subject}\n${input.bodyText}`;
  return sensitivePatterns.filter((pattern) => pattern.test(combined)).map((pattern) => pattern.source);
}

export function assertSafeEmailPayload(payload: EmailSyncSendPayload, allowSensitiveOverride = false) {
  const matches = findSensitiveEmailSignals({ subject: payload.subject, bodyText: payload.bodyText });
  return {
    safe: allowSensitiveOverride ? true : matches.length === 0,
    matches
  };
}

export function buildDryRunThreadImport(thread: EmailThreadMetadata): EmailThreadImportPreview {
  return {
    externalThreadId: thread.externalThreadId,
    subjectPreview: thread.subjectPreview,
    messages: [
      sanitizeMessageMetadata({
        externalMessageId: `${thread.externalThreadId}-preview-inbound`,
        direction: "inbound",
        sender: thread.fromPreview,
        recipients: thread.toPreview,
        sentAt: thread.lastMessageAt,
        subject: thread.subjectPreview,
        bodyPreview: "Metadata-only preview. Full email body import requires explicit confirmation."
      }),
      sanitizeMessageMetadata({
        externalMessageId: `${thread.externalThreadId}-preview-outbound`,
        direction: "outbound",
        sender: thread.toPreview[0] || "agent@example.com",
        recipients: [thread.fromPreview],
        sentAt: thread.lastMessageAt,
        subject: thread.subjectPreview,
        bodyPreview: minimizeBodyPreview("Reply preview only. Sensitive client documents and visa details should stay in the secure portal.")
      })
    ],
    importWarning: "Email sync stores minimised metadata by default. Full body import requires explicit review."
  };
}
