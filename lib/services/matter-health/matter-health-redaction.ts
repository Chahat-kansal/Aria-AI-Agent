import { Prisma } from "@prisma/client";

const SENSITIVE_PATTERNS = [
  /\bpassport\b/i,
  /\bdob\b/i,
  /\bdate of birth\b/i,
  /\bgrant\b/i,
  /\btrn\b/i,
  /\btoken\b/i,
  /\burl\b/i,
  /\blink\b/i,
  /\bhealth\b/i,
  /\bcharacter\b/i,
  /\bfinancial\b/i
] as const;

export function redactMatterHealthText(value: string | null | undefined) {
  if (!value) return null;
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "Redacted operational summary";
  }
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
}

export function redactMatterHealthAuditMetadata(metadata: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (/client|title|summary|reason|snippet|note|name/i.test(key)) {
        return [key, typeof value === "string" ? redactMatterHealthText(value) : null];
      }
      if (/route/i.test(key)) {
        return [key, typeof value === "string" ? value.replace(/\/app\/matters\/[^/?#]+/g, "/app/matters/[id]") : null];
      }
      return [key, value];
    })
  ) as Prisma.InputJsonObject;
}

export function redactMatterHealthBreakdownLabel(label: string) {
  return redactMatterHealthText(label) || "Redacted";
}
