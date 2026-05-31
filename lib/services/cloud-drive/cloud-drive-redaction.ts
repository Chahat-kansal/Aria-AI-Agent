import crypto from "crypto";

export function sanitizeCloudDriveName(value: string, fallback = "record") {
  const normalized = value
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const safe = normalized.replace(/[^a-zA-Z0-9._ -]+/g, "").trim();
  return safe || fallback;
}

export function buildRecipientSafeReference(input: { clientReference?: string | null; fallbackId: string }) {
  return sanitizeCloudDriveName(input.clientReference || `Client-${input.fallbackId.slice(0, 8)}`, "Client");
}

export function hashStorageReference(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function redactCloudDriveError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error || "Unknown error");
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9._-]+/g, "[redacted-token]")
    .slice(0, 180);
}

export function redactCloudDriveManifestJson(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, current) => {
    if (typeof current !== "string") return current;
    if (/https?:\/\//i.test(current)) return "[redacted-url]";
    if (/token/i.test(current)) return "[redacted-token]";
    if (/passport|grant|date of birth|dob|health|character/i.test(current)) return "[redacted-sensitive]";
    return current;
  }));
}
