import { sha256Hex } from "@/lib/security/hash";

export function getEndpointLast8(value: string) {
  return value.slice(-8) || "";
}

export function hashEndpoint(value: string) {
  return sha256Hex(value.trim());
}

export function redactPushPreview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function redactPushErrorSummary(value?: string | null) {
  if (!value) return null;
  return value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/-----BEGIN[\s\S]+?END [A-Z ]+-----/g, "[redacted-key]")
    .slice(0, 180);
}

export function redactPushMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (/endpoint|subscription|device/i.test(key)) {
        return [key, typeof value === "string" ? `***${getEndpointLast8(value)}` : "[redacted]"];
      }
      if (/body|title|message/i.test(key)) {
        return [key, typeof value === "string" ? redactPushPreview(value) : "[redacted]"];
      }
      if (/token|secret|key|url|hash/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, value];
    })
  );
}
