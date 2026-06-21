import { containsForbiddenOfflineContent } from "@/lib/services/offline/offline-policy";

export function redactOfflinePreview(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return containsForbiddenOfflineContent(trimmed) ? "[redacted]" : trimmed.slice(0, 160);
}

export function redactOfflineMetadata(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, containsForbiddenOfflineContent(value) ? "[redacted]" : value.slice(0, 160)];
      }
      return [key, value];
    })
  );
}
