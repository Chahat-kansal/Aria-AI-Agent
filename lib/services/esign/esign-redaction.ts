import { redactErrorSummary } from "@/lib/providers/shared";

export function redactEsignText(value?: string | null, maxLength = 220) {
  if (!value) return null;
  return redactErrorSummary(
    value
      .replace(/[A-Z]\d{7,}/g, "[redacted-id]")
      .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "[redacted-date]")
      .replace(/\b\d{8,}\b/g, "[redacted-number]")
  )?.slice(0, maxLength) ?? null;
}

export function redactEsignPayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactEsignPayload(item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const redacted = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (/token|secret|password|hash|documenturl|storagekey|raw|private/i.test(key)) {
        return [key, "[redacted]"];
      }
      if (/answer|response|detail|content|body/i.test(key) && typeof entry === "string") {
        return [key, redactEsignText(entry)];
      }
      return [key, redactEsignPayload(entry)];
    })
  );
  return redacted as T;
}
