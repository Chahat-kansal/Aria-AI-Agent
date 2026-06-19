const FORBIDDEN_OFFLINE_PATTERNS = [
  /\bpassport\b/i,
  /\bdate of birth\b/i,
  /\bdob\b/i,
  /\bvisa grant\b/i,
  /\bgrant number\b/i,
  /\btrn\b/i,
  /\bhealth\b/i,
  /\bcharacter\b/i,
  /\bfinancial\b/i,
  /\brelationship\b/i,
  /\bdocument text\b/i,
  /\bextracted\b/i,
  /\bdraft field\b/i,
  /\btokenhash\b/i,
  /\braw token\b/i,
  /\bportal token\b/i,
  /\bevidence vault\b/i,
  /\bai output\b/i,
  /https?:\/\/\S+/i
];

export const OFFLINE_TASK_SCOPE_KEY = "aria.offline-tasks.scope";
export const OFFLINE_TASK_QUEUE_KEY = "aria.offline-tasks.queue";
export const OFFLINE_TASK_DRAFTS_KEY = "aria.offline-tasks.drafts";

export const OFFLINE_SAFETY_WARNING =
  "Do not enter passport numbers, visa grant numbers, health or character details, or private document information into offline notes.";

export type OfflineScope = {
  workspaceId: string;
  userId: string;
};

export function getOfflineScopeValue(scope: OfflineScope) {
  return `${scope.workspaceId}:${scope.userId}`;
}

export function getOfflineTaskStorageKey(baseKey: string, scope: OfflineScope) {
  return `${baseKey}:${getOfflineScopeValue(scope)}`;
}

export function containsForbiddenOfflineContent(value: string | null | undefined) {
  if (!value) return false;
  return FORBIDDEN_OFFLINE_PATTERNS.some((pattern) => pattern.test(value));
}

export function assertOfflineSafeContent(value: string | null | undefined, fieldLabel = "Offline text") {
  if (containsForbiddenOfflineContent(value)) {
    throw new Error(`${fieldLabel} contains content that cannot be saved offline.`);
  }
  return value?.trim() || "";
}

export function isOfflineSafeContent(value: string | null | undefined) {
  return !containsForbiddenOfflineContent(value);
}

export function getOfflineSensitiveNoteMessage() {
  return "Sensitive notes require internet connection.";
}

export function getOfflineSupportSummary() {
  return "Offline mode is limited to low-risk task metadata. Sensitive notes, documents, AI drafts, and private portal data stay online-only.";
}
