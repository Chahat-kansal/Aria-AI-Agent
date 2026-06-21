import { redactAuditMetadata } from "@/lib/security/redaction";

export function redactChasingMetadata(value: Record<string, unknown> = {}) {
  return redactAuditMetadata(value) as Record<string, unknown>;
}

export function redactChasingPreview(value: { subject?: string | null; body: string; route?: string | null }) {
  return {
    subject: value.subject ?? null,
    body: value.body.replace(/\s+/g, " ").trim().slice(0, 220),
    route: value.route ?? null
  };
}

export function redactChasingReason(reason: string | null | undefined) {
  return (reason || "").replace(/\s+/g, " ").trim().slice(0, 160) || null;
}
