import { sha256Hex } from "@/lib/security/hash";

export function normalizePhoneDigits(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function getRecipientLast4(value: string) {
  const digits = normalizePhoneDigits(value).replace(/^\+/, "");
  return digits.slice(-4) || "";
}

export function maskPhoneNumber(value: string) {
  const digits = normalizePhoneDigits(value);
  const last4 = getRecipientLast4(digits);
  return last4 ? `***${last4}` : "[redacted]";
}

export function hashPhoneNumber(value: string) {
  return sha256Hex(normalizePhoneDigits(value));
}

export function redactSmsPreview(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function redactSmsErrorSummary(value?: string | null) {
  if (!value) return null;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [redacted]")
    .replace(/AC[a-z0-9]{10,}/gi, "AC[redacted]")
    .replace(/SK[a-z0-9]{10,}/gi, "SK[redacted]")
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .slice(0, 180);
}

export function redactSmsMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (/phone|recipient/i.test(key)) {
        return [key, typeof value === "string" ? maskPhoneNumber(value) : "[redacted]"];
      }
      if (/body|message/i.test(key)) {
        return [key, typeof value === "string" ? redactSmsPreview(value) : "[redacted]"];
      }
      if (/token|secret|auth|sid|url|hash|key/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, value];
    })
  );
}
