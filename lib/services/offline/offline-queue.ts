"use client";

import {
  OFFLINE_SAFETY_WARNING,
  OFFLINE_TASK_DRAFTS_KEY,
  OFFLINE_TASK_QUEUE_KEY,
  OFFLINE_TASK_SCOPE_KEY,
  type OfflineScope,
  getOfflineScopeValue,
  getOfflineTaskStorageKey
} from "@/lib/services/offline/offline-policy";
import type {
  OfflineTaskConflictStatus,
  OfflineTaskPriority,
  OfflineTaskStatus,
  OfflineTaskSyncStatus
} from "@/lib/services/offline/offline-conflict-resolution";

export type OfflineTaskRecord = {
  id: string;
  serverId: string | null;
  title: string;
  safeDescription: string;
  dueDate: string;
  status: OfflineTaskStatus;
  priority: OfflineTaskPriority;
  matterId: string | null;
  matterReferenceSnapshot: string | null;
  assignedToUserId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  lastServerUpdatedAt: string | null;
  syncStatus: OfflineTaskSyncStatus;
  conflictStatus: OfflineTaskConflictStatus;
};

export type OfflineTaskOperation = {
  id: string;
  type: "create" | "update" | "complete";
  taskId: string;
  serverId: string | null;
  baseUpdatedAt: string | null;
  payload: Partial<OfflineTaskRecord> & { offlineCreatedAt?: string | null };
  queuedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T) {
  if (!canUseStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function ensureOfflineScope(scope: OfflineScope) {
  if (!canUseStorage()) return;
  const nextScope = getOfflineScopeValue(scope);
  const currentScope = window.localStorage.getItem(OFFLINE_TASK_SCOPE_KEY);

  if (currentScope && currentScope !== nextScope) {
    clearOfflineTaskCache();
  }

  window.localStorage.setItem(OFFLINE_TASK_SCOPE_KEY, nextScope);
}

export function listOfflineTaskDrafts(scope: OfflineScope) {
  return readJson<OfflineTaskRecord[]>(getOfflineTaskStorageKey(OFFLINE_TASK_DRAFTS_KEY, scope), []);
}

export function saveOfflineTaskDrafts(scope: OfflineScope, drafts: OfflineTaskRecord[]) {
  writeJson(getOfflineTaskStorageKey(OFFLINE_TASK_DRAFTS_KEY, scope), drafts);
}

export function listOfflineTaskQueue(scope: OfflineScope) {
  return readJson<OfflineTaskOperation[]>(getOfflineTaskStorageKey(OFFLINE_TASK_QUEUE_KEY, scope), []);
}

export function saveOfflineTaskQueue(scope: OfflineScope, queue: OfflineTaskOperation[]) {
  writeJson(getOfflineTaskStorageKey(OFFLINE_TASK_QUEUE_KEY, scope), queue);
}

export function enqueueOfflineTaskOperation(scope: OfflineScope, operation: OfflineTaskOperation) {
  const queue = listOfflineTaskQueue(scope);
  queue.push(operation);
  saveOfflineTaskQueue(scope, queue);
  return queue;
}

export function clearOfflineTaskCache() {
  if (!canUseStorage()) return;
  const keys = Object.keys(window.localStorage).filter((key) =>
    key === OFFLINE_TASK_SCOPE_KEY ||
    key.startsWith(`${OFFLINE_TASK_QUEUE_KEY}:`) ||
    key.startsWith(`${OFFLINE_TASK_DRAFTS_KEY}:`)
  );
  keys.forEach((key) => window.localStorage.removeItem(key));
}

export function getOfflineSafetyNotice() {
  return OFFLINE_SAFETY_WARNING;
}
