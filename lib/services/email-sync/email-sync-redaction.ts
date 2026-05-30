import type { EmailMessageMetadata, EmailThreadMetadata } from "@/lib/providers/email-sync-provider";

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function redactMailboxAddress(value: string) {
  const trimmed = collapseWhitespace(value);
  const match = trimmed.match(/<?([^<>\s]+@[^<>\s]+)>?/);
  const address = match?.[1] || trimmed;
  const [localPart = "", domain = ""] = address.split("@");
  if (!domain) return localPart.length > 4 ? `${localPart.slice(0, 2)}***${localPart.slice(-1)}` : "[redacted-email]";
  const visibleLocal = localPart.length <= 2 ? `${localPart.slice(0, 1)}***` : `${localPart.slice(0, 2)}***${localPart.slice(-1)}`;
  return `${visibleLocal}@${domain}`;
}

export function minimizeSubjectPreview(value: string | null | undefined) {
  const collapsed = collapseWhitespace(value || "");
  if (!collapsed) return "No subject";
  return collapsed
    .replace(/\b[A-Z]\d{7,9}\b/g, "[redacted-ref]")
    .replace(/\b\d{6,12}\b/g, "[redacted-number]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .slice(0, 120);
}

export function minimizeBodyPreview(value: string | null | undefined) {
  const collapsed = collapseWhitespace(value || "");
  if (!collapsed) return null;
  return collapsed
    .replace(/\b[A-Z]\d{7,9}\b/g, "[redacted-ref]")
    .replace(/\b\d{6,12}\b/g, "[redacted-number]")
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .slice(0, 280);
}

export function redactEmailSyncError(value?: string | null) {
  if (!value) return null;
  return collapseWhitespace(value)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/refresh_token=([^&\s]+)/gi, "refresh_token=[redacted]")
    .replace(/access_token=([^&\s]+)/gi, "access_token=[redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .slice(0, 180);
}

export function sanitizeThreadMetadata(input: {
  externalThreadId: string;
  externalMessageId?: string | null;
  subject?: string | null;
  from?: string | null;
  to?: Array<string | null | undefined>;
  lastMessageAt?: string | null;
  messageCount?: number | null;
  hasImportedBody?: boolean;
}): EmailThreadMetadata {
  return {
    externalThreadId: input.externalThreadId,
    externalMessageId: input.externalMessageId ?? null,
    subjectPreview: minimizeSubjectPreview(input.subject),
    fromPreview: redactMailboxAddress(input.from || "unknown@example.com"),
    toPreview: (input.to || []).map((item) => redactMailboxAddress(item || "")).filter(Boolean),
    lastMessageAt: input.lastMessageAt ?? null,
    messageCount: Math.max(1, input.messageCount ?? 1),
    hasImportedBody: input.hasImportedBody ?? false
  };
}

export function sanitizeMessageMetadata(input: {
  externalMessageId: string;
  direction: "inbound" | "outbound";
  sender?: string | null;
  recipients?: Array<string | null | undefined>;
  sentAt?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  bodyImported?: boolean;
}): EmailMessageMetadata {
  return {
    externalMessageId: input.externalMessageId,
    direction: input.direction,
    senderLabel: redactMailboxAddress(input.sender || "unknown@example.com"),
    recipientLabels: (input.recipients || []).map((item) => redactMailboxAddress(item || "")).filter(Boolean),
    sentAt: input.sentAt ?? null,
    subjectPreview: minimizeSubjectPreview(input.subject),
    bodyPreview: minimizeBodyPreview(input.bodyPreview),
    bodyImported: input.bodyImported ?? false
  };
}
