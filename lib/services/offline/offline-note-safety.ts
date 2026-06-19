import {
  assertOfflineSafeContent,
  containsForbiddenOfflineContent,
  getOfflineSensitiveNoteMessage
} from "@/lib/services/offline/offline-policy";

export type OfflineNoteSafetyResult = {
  allowed: boolean;
  reason: string | null;
  sanitized: string;
};

export function evaluateOfflineNoteSafety(value: string | null | undefined): OfflineNoteSafetyResult {
  const sanitized = value?.trim() || "";
  if (!sanitized) {
    return { allowed: true, reason: null, sanitized: "" };
  }

  if (containsForbiddenOfflineContent(sanitized)) {
    return {
      allowed: false,
      reason: getOfflineSensitiveNoteMessage(),
      sanitized: ""
    };
  }

  return {
    allowed: true,
    reason: null,
    sanitized: assertOfflineSafeContent(sanitized, "Offline note")
  };
}
