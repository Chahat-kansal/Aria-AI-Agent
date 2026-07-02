import { redactAuditMetadata } from "@/lib/security/redaction";

export function redactDeadlinePreview(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

export function redactDeadlineReason(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function redactDeadlineMetadata(value: Record<string, unknown>) {
  return redactAuditMetadata(value);
}
