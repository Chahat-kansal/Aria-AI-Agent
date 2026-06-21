"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ConflictTaskSnapshot,
  ConflictResolutionStrategy,
  OfflineTaskConflictStatus,
  OfflineTaskPriority,
  OfflineTaskStatus,
  OfflineTaskSyncStatus
} from "@/lib/services/offline/offline-conflict-resolution";
import { resolveTaskConflict } from "@/lib/services/offline/offline-conflict-resolution";
import {
  clearOfflineTaskCache,
  enqueueOfflineTaskOperation,
  ensureOfflineScope,
  getOfflineSafetyNotice,
  listOfflineTaskDrafts,
  listOfflineTaskQueue,
  saveOfflineTaskDrafts,
  saveOfflineTaskQueue,
  type OfflineTaskOperation,
  type OfflineTaskRecord
} from "@/lib/services/offline/offline-queue";
import {
  containsForbiddenOfflineContent,
  getOfflineSensitiveNoteMessage,
  getOfflineSupportSummary,
  type OfflineScope
} from "@/lib/services/offline/offline-policy";

type TaskOption = {
  id: string;
  name: string;
  email: string;
};

type MatterOption = {
  id: string;
  label: string;
  matterReference: string | null;
};

type TaskRecord = {
  id: string;
  title: string;
  safeDescription: string | null;
  dueDate: string;
  status: OfflineTaskStatus;
  priority: OfflineTaskPriority;
  category: string | null;
  matterId: string | null;
  matterReferenceSnapshot: string | null;
  assignedToUserId: string;
  assignedToUserName: string;
  createdByUserId: string | null;
  createdByUserName: string | null;
  updatedAt: string;
  lastSyncedAt: string | null;
  syncStatus: OfflineTaskSyncStatus;
  conflictStatus: OfflineTaskConflictStatus;
};

type ConflictItem = {
  taskId: string;
  localTask: ConflictTaskSnapshot;
  serverTask: ConflictTaskSnapshot;
};

const PRIORITY_OPTIONS: OfflineTaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUS_OPTIONS: OfflineTaskStatus[] = ["OPEN", "IN_PROGRESS", "DONE", "BLOCKED"];

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDueDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function toInputDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function buildTaskSnapshot(task: TaskRecord): ConflictTaskSnapshot {
  return {
    id: task.id,
    title: task.title,
    safeDescription: task.safeDescription,
    dueDate: task.dueDate,
    status: task.status,
    priority: task.priority,
    matterId: task.matterId,
    matterReferenceSnapshot: task.matterReferenceSnapshot,
    assignedToUserId: task.assignedToUserId,
    updatedAt: task.updatedAt,
    syncStatus: task.syncStatus,
    conflictStatus: task.conflictStatus
  };
}

function makeLocalId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mergeVisibleTasks(initialTasks: TaskRecord[], drafts: OfflineTaskRecord[]): TaskRecord[] {
  const base = new Map(initialTasks.map((task) => [task.id, task]));

  for (const draft of drafts) {
    if (draft.serverId && base.has(draft.serverId)) {
      const original = base.get(draft.serverId)!;
      base.set(draft.serverId, {
        ...original,
        title: draft.title,
        safeDescription: draft.safeDescription || null,
        dueDate: draft.dueDate,
        status: draft.status,
        priority: draft.priority,
        matterId: draft.matterId,
        matterReferenceSnapshot: draft.matterReferenceSnapshot,
        assignedToUserId: draft.assignedToUserId,
        updatedAt: draft.updatedAt,
        lastSyncedAt: draft.lastSyncedAt,
        syncStatus: draft.syncStatus,
        conflictStatus: draft.conflictStatus
      });
      continue;
    }

    base.set(draft.id, {
      id: draft.id,
      title: draft.title,
      safeDescription: draft.safeDescription || null,
      dueDate: draft.dueDate,
      status: draft.status,
      priority: draft.priority,
      category: null,
      matterId: draft.matterId,
      matterReferenceSnapshot: draft.matterReferenceSnapshot,
      assignedToUserId: draft.assignedToUserId,
      assignedToUserName: "Pending sync",
      createdByUserId: draft.createdByUserId,
      createdByUserName: "Offline draft",
      updatedAt: draft.updatedAt,
      lastSyncedAt: draft.lastSyncedAt,
      syncStatus: draft.syncStatus,
      conflictStatus: draft.conflictStatus
    });
  }

  return Array.from(base.values()).sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

type FormState = {
  mode: "create" | "edit";
  taskId: string | null;
  title: string;
  safeDescription: string;
  dueDate: string;
  priority: OfflineTaskPriority;
  status: OfflineTaskStatus;
  matterId: string;
  matterReferenceSnapshot: string;
  assignedToUserId: string;
};

function buildEmptyForm(currentUserId: string): FormState {
  return {
    mode: "create",
    taskId: null,
    title: "",
    safeDescription: "",
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    priority: "MEDIUM",
    status: "OPEN",
    matterId: "",
    matterReferenceSnapshot: "",
    assignedToUserId: currentUserId
  };
}

export function OfflineTaskBoard({
  workspaceId,
  currentUserId,
  initialTasks,
  matters,
  users
}: {
  workspaceId: string;
  currentUserId: string;
  initialTasks: TaskRecord[];
  matters: MatterOption[];
  users: TaskOption[];
}) {
  const scope = useMemo<OfflineScope>(() => ({ workspaceId, userId: currentUserId }), [workspaceId, currentUserId]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildEmptyForm(currentUserId));
  const [serverTasks, setServerTasks] = useState<TaskRecord[]>(initialTasks);
  const [drafts, setDrafts] = useState<OfflineTaskRecord[]>([]);
  const [queue, setQueue] = useState<OfflineTaskOperation[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>(initialTasks);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);

  useEffect(() => {
    ensureOfflineScope(scope);
    const refreshOnline = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    refreshOnline();
    setDrafts(listOfflineTaskDrafts(scope));
    setQueue(listOfflineTaskQueue(scope));
    window.addEventListener("online", refreshOnline);
    window.addEventListener("offline", refreshOnline);
    return () => {
      window.removeEventListener("online", refreshOnline);
      window.removeEventListener("offline", refreshOnline);
    };
  }, [scope]);

  useEffect(() => {
    setTasks(mergeVisibleTasks(serverTasks, drafts));
  }, [drafts, serverTasks]);

  useEffect(() => {
    setServerTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    saveOfflineTaskDrafts(scope, drafts);
  }, [drafts, scope]);

  useEffect(() => {
    saveOfflineTaskQueue(scope, queue);
  }, [queue, scope]);

  useEffect(() => {
    if (!online || !queue.length || syncing) return;
    void syncNow(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  function resetForm() {
    setForm(buildEmptyForm(currentUserId));
    setShowForm(false);
  }

  function openCreate() {
    setError(null);
    setMessage(null);
    setForm(buildEmptyForm(currentUserId));
    setShowForm(true);
  }

  function openEdit(task: TaskRecord) {
    setError(null);
    setMessage(null);
    setForm({
      mode: "edit",
      taskId: task.id,
      title: task.title,
      safeDescription: task.safeDescription || "",
      dueDate: toInputDate(task.dueDate),
      priority: task.priority,
      status: task.status,
      matterId: task.matterId || "",
      matterReferenceSnapshot: task.matterReferenceSnapshot || "",
      assignedToUserId: task.assignedToUserId
    });
    setShowForm(true);
  }

  function validateOfflineSafeFields(input: FormState) {
    if (containsForbiddenOfflineContent(input.title) || containsForbiddenOfflineContent(input.safeDescription) || containsForbiddenOfflineContent(input.matterReferenceSnapshot)) {
      return getOfflineSensitiveNoteMessage();
    }
    return null;
  }

  async function saveOnline(input: FormState) {
    const existingDraft = input.taskId ? drafts.find((draft) => draft.id === input.taskId) : null;
    const targetTaskId = existingDraft?.serverId || input.taskId;
    const shouldCreate = input.mode === "create" || Boolean(existingDraft && !existingDraft.serverId);
    const body = {
      matterId: input.matterId || null,
      matterReferenceSnapshot: input.matterReferenceSnapshot || null,
      assignedToUserId: input.assignedToUserId,
      title: input.title,
      safeDescription: input.safeDescription || null,
      dueDate: new Date(`${input.dueDate}T09:00:00.000Z`).toISOString(),
      status: input.status,
      priority: input.priority
    };

    const response = await fetch(shouldCreate ? "/api/tasks" : `/api/tasks/${targetTaskId}`, {
      method: shouldCreate ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shouldCreate ? body : { ...body, baseUpdatedAt: tasks.find((task) => task.id === input.taskId)?.updatedAt })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to save task.");
    }

    const nextTask = payload.task as TaskRecord;
    setServerTasks((current) => {
      const filtered = current.filter((task) => task.id !== nextTask.id);
      return [...filtered, nextTask];
    });
    setDrafts((current) => current.filter((draft) => draft.serverId !== nextTask.id && draft.id !== nextTask.id && draft.id !== input.taskId));
    setQueue((current) => current.filter((operation) => operation.taskId !== input.taskId));
    setMessage(input.mode === "create" ? "Task created." : "Task updated.");
  }

  function queueOfflineSave(input: FormState) {
    const validationError = validateOfflineSafeFields(input);
    if (validationError) {
      throw new Error(validationError);
    }

    const existing = input.taskId ? tasks.find((task) => task.id === input.taskId) : null;
    const existingDraft = input.taskId ? drafts.find((draft) => draft.id === input.taskId) : null;
    const localId = input.mode === "create" ? makeLocalId() : input.taskId!;
    const serverId = existingDraft?.serverId || (existing && !existing.id.startsWith("offline-") ? existing.id : null);
    const now = new Date().toISOString();

    const draft: OfflineTaskRecord = {
      id: localId,
      serverId,
      title: input.title.trim(),
      safeDescription: input.safeDescription.trim(),
      dueDate: new Date(`${input.dueDate}T09:00:00.000Z`).toISOString(),
      status: input.status,
      priority: input.priority,
      matterId: input.matterId || null,
      matterReferenceSnapshot: input.matterReferenceSnapshot || null,
      assignedToUserId: input.assignedToUserId,
      createdByUserId: currentUserId,
      createdAt: existing?.updatedAt || now,
      updatedAt: now,
      lastSyncedAt: existing?.lastSyncedAt || null,
      lastServerUpdatedAt: existing?.updatedAt || null,
      syncStatus: "PENDING",
      conflictStatus: "NONE"
    };

    const operation: OfflineTaskOperation = {
      id: makeLocalId(),
      type: input.mode === "create" || !serverId ? "create" : input.status === "DONE" ? "complete" : "update",
      taskId: localId,
      serverId,
      baseUpdatedAt: existing?.updatedAt || null,
      payload: {
        matterId: draft.matterId,
        matterReferenceSnapshot: draft.matterReferenceSnapshot,
        assignedToUserId: draft.assignedToUserId,
        title: draft.title,
        safeDescription: draft.safeDescription,
        dueDate: draft.dueDate,
        status: draft.status,
        priority: draft.priority,
        offlineCreatedAt: input.mode === "create" ? now : null
      },
      queuedAt: now
    };

    setDrafts((current) => {
      const filtered = current.filter((item) => item.id !== localId && item.serverId !== serverId);
      return [...filtered, draft];
    });
    setQueue((current) => [...current.filter((entry) => entry.taskId !== localId), operation]);
    setMessage(input.mode === "create" ? "Task saved for sync when you're back online." : "Task changes queued for sync.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      if (online) {
        await saveOnline(form);
      } else {
        queueOfflineSave(form);
      }
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save task.");
    }
  }

  async function markDone(task: TaskRecord) {
    setError(null);
    setMessage(null);
    if (task.status === "DONE") return;

    if (online) {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", baseUpdatedAt: task.updatedAt })
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 409 && payload?.task) {
        setConflicts((current) => [
          ...current,
          {
            taskId: task.id,
            localTask: buildTaskSnapshot(task),
            serverTask: buildTaskSnapshot(payload.task as TaskRecord)
          }
        ]);
        setError("Task conflict detected. Choose how to resolve it.");
        return;
      }
      if (!response.ok) {
        setError(payload?.error || "Unable to complete task.");
        return;
      }
      const nextTask = payload.task as TaskRecord;
      setServerTasks((current) => current.map((item) => (item.id === nextTask.id ? nextTask : item)));
      setMessage("Task completed.");
      return;
    }

    queueOfflineSave({
      mode: "edit",
      taskId: task.id,
      title: task.title,
      safeDescription: task.safeDescription || "",
      dueDate: toInputDate(task.dueDate),
      priority: task.priority,
      status: "DONE",
      matterId: task.matterId || "",
      matterReferenceSnapshot: task.matterReferenceSnapshot || "",
      assignedToUserId: task.assignedToUserId
    });
  }

  async function syncNow(auto = false) {
    if (!queue.length || syncing || !online) return;
    setSyncing(true);
    setError(null);
    if (!auto) setMessage(null);

    try {
      const response = await fetch("/api/tasks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations: queue })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Unable to sync offline tasks.");
      }

      const nextConflicts: ConflictItem[] = [];
      const successfulIds = new Set<string>();
      const successfulTaskIds = new Set<string>();

      for (const result of payload.results as Array<Record<string, any>>) {
        if (result.conflict && result.task) {
          const localDraft = drafts.find((draft) => draft.serverId === result.task.id || draft.id === result.task.id);
          if (localDraft) {
            nextConflicts.push({
              taskId: result.task.id,
              localTask: {
                id: localDraft.id,
                title: localDraft.title,
                safeDescription: localDraft.safeDescription || null,
                dueDate: localDraft.dueDate,
                status: localDraft.status,
                priority: localDraft.priority,
                matterId: localDraft.matterId,
                matterReferenceSnapshot: localDraft.matterReferenceSnapshot,
                assignedToUserId: localDraft.assignedToUserId,
                updatedAt: localDraft.updatedAt,
                syncStatus: localDraft.syncStatus,
                conflictStatus: localDraft.conflictStatus
              },
              serverTask: buildTaskSnapshot(result.task as TaskRecord)
            });
          }
          continue;
        }

        if (result.ok) {
          successfulIds.add(result.operationId);
          if (result.taskId) successfulTaskIds.add(String(result.taskId));
          if (result.task) {
            setServerTasks((current) => {
              const task = result.task as TaskRecord;
              const filtered = current.filter((item) => item.id !== task.id);
              return [...filtered, task];
            });
          }
        }
      }

      setQueue((current) => current.filter((operation) => !successfulIds.has(operation.id)));
      setDrafts((current) =>
        current.filter((draft) => {
          if (successfulTaskIds.has(draft.id)) return false;
          if (draft.serverId && successfulTaskIds.has(draft.serverId)) return false;
          return true;
        })
      );
      setConflicts(nextConflicts);
      setMessage(nextConflicts.length ? "Some task conflicts need review." : "Offline task changes synced.");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Unable to sync offline tasks.");
    } finally {
      setSyncing(false);
    }
  }

  function resolveConflictItem(item: ConflictItem, strategy: ConflictResolutionStrategy) {
    const resolved = resolveTaskConflict(item.localTask, item.serverTask, strategy);
    setConflicts((current) => current.filter((conflict) => conflict.taskId !== item.taskId));

    if (strategy === "keep_server") {
      setDrafts((current) => current.filter((draft) => draft.id !== item.localTask.id && draft.serverId !== item.serverTask.id));
      setQueue((current) => current.filter((operation) => operation.taskId !== item.localTask.id && operation.serverId !== item.serverTask.id));
      setServerTasks((current) => current.map((task) => (task.id === item.serverTask.id ? { ...task, ...item.serverTask } : task)));
      return;
    }

    const now = new Date().toISOString();
    const draft: OfflineTaskRecord = {
      id: item.localTask.id,
      serverId: item.serverTask.id,
      title: resolved.resolved.title,
      safeDescription: resolved.resolved.safeDescription || "",
      dueDate: resolved.resolved.dueDate,
      status: resolved.resolved.status,
      priority: resolved.resolved.priority,
      matterId: resolved.resolved.matterId,
      matterReferenceSnapshot: resolved.resolved.matterReferenceSnapshot,
      assignedToUserId: resolved.resolved.assignedToUserId,
      createdByUserId: currentUserId,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      lastServerUpdatedAt: item.serverTask.updatedAt,
      syncStatus: resolved.syncStatus,
      conflictStatus: resolved.conflictStatus
    };
    const operation: OfflineTaskOperation = {
      id: makeLocalId(),
      type: draft.status === "DONE" ? "complete" : "update",
      taskId: draft.id,
      serverId: item.serverTask.id,
      baseUpdatedAt: item.serverTask.updatedAt,
      payload: {
        title: draft.title,
        safeDescription: draft.safeDescription,
        dueDate: draft.dueDate,
        status: draft.status,
        priority: draft.priority,
        matterId: draft.matterId,
        matterReferenceSnapshot: draft.matterReferenceSnapshot,
        assignedToUserId: draft.assignedToUserId
      },
      queuedAt: now
    };
    setDrafts((current) => [...current.filter((entry) => entry.id !== draft.id && entry.serverId !== draft.serverId), draft]);
    setQueue((current) => [...current.filter((entry) => entry.taskId !== draft.id && entry.serverId !== draft.serverId), operation]);
    setMessage("Conflict resolution queued for sync.");
  }

  const pendingCount = queue.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.95fr)]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Task dashboard</h2>
              <p className="mt-1 text-sm text-slate-400">{getOfflineSupportSummary()}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                Safe offline mode
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${online ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>
                {online ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          {!online ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              You are offline. Only low-risk task metadata can be queued locally.
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Visible tasks</p>
              <p className="mt-2 text-2xl font-semibold text-white">{tasks.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pending sync</p>
              <p className="mt-2 text-2xl font-semibold text-white">{pendingCount}</p>
              {pendingCount ? <p className="mt-2 text-xs text-amber-200">Pending sync badge active</p> : null}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Conflicts</p>
              <p className="mt-2 text-2xl font-semibold text-white">{conflicts.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Offline cache</p>
              <button
                type="button"
                onClick={() => {
                  clearOfflineTaskCache();
                  setDrafts([]);
                  setQueue([]);
                  setConflicts([]);
                  setMessage("Offline cache cleared.");
                }}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white"
              >
                Clear cache
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white"
            >
              Create task
            </button>
            <button
              type="button"
              onClick={() => void syncNow(false)}
              disabled={!online || !pendingCount || syncing}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync now"}
            </button>
          </div>

          {message ? <p className="mt-4 text-sm text-emerald-200">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Offline safety notice</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{getOfflineSafetyNotice()}</p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-sm font-medium text-white">Sensitive notes stay online-only</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Offline-safe note drafts are allowed for low-risk reminders. Sensitive matter notes, documents, AI drafts, and private portal data are not stored offline.
            </p>
          </div>
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            Sensitive offline content blocked warning: task notes containing passport numbers, grant numbers, raw URLs, or private matter details are rejected.
          </div>
        </div>
      </section>

      {showForm ? (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{form.mode === "create" ? "Create task" : "Edit task"}</h2>
              <p className="mt-1 text-sm text-slate-400">Offline-safe note drafts only. Sensitive content requires internet connection.</p>
            </div>
            <button type="button" onClick={resetForm} className="text-sm text-slate-300 hover:text-white">Cancel</button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Task title</span>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white" required />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Due date</span>
              <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white" required />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Priority</span>
              <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as OfflineTaskPriority }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white">
                {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{formatEnum(option)}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as OfflineTaskStatus }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white">
                {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option === "OPEN" ? "To do" : formatEnum(option)}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Matter</span>
              <select value={form.matterId} onChange={(event) => {
                const selected = matters.find((matter) => matter.id === event.target.value);
                setForm((current) => ({
                  ...current,
                  matterId: event.target.value,
                  matterReferenceSnapshot: selected?.matterReference || current.matterReferenceSnapshot
                }));
              }} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white">
                <option value="">Personal task / no matter</option>
                {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Assigned agent</span>
              <select value={form.assignedToUserId} onChange={(event) => setForm((current) => ({ ...current, assignedToUserId: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white">
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
              <span>Generic matter reference</span>
              <input value={form.matterReferenceSnapshot} onChange={(event) => setForm((current) => ({ ...current, matterReferenceSnapshot: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white" placeholder="Use a generic reference instead of sensitive details." />
            </label>
            <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
              <span>Offline-safe note draft</span>
              <textarea value={form.safeDescription} onChange={(event) => setForm((current) => ({ ...current, safeDescription: event.target.value }))} className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white" placeholder="Low-risk reminders only. Sensitive notes require internet connection." />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                {form.mode === "create" ? (online ? "Create task" : "Queue offline task") : (online ? "Save task" : "Queue task update")}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {conflicts.length ? (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
          <h2 className="text-lg font-semibold text-white">Conflict detected state</h2>
          <p className="mt-1 text-sm text-amber-100">A server copy changed before your offline update could sync. Choose how to resolve each task.</p>
          <div className="mt-4 space-y-3">
            {conflicts.map((conflict) => (
              <div key={conflict.taskId} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="font-medium text-white">{conflict.localTask.title}</p>
                <p className="mt-1 text-sm text-slate-300">Local status: {formatEnum(conflict.localTask.status)} · Server status: {formatEnum(conflict.serverTask.status)}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" onClick={() => resolveConflictItem(conflict, "keep_local")} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white">Keep local</button>
                  <button type="button" onClick={() => resolveConflictItem(conflict, "keep_server")} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white">Keep server</button>
                  <button type="button" onClick={() => resolveConflictItem(conflict, "merge_safe")} className="inline-flex h-10 items-center justify-center rounded-2xl bg-white text-sm font-medium text-slate-950 px-4">Merge safe</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Task list</h2>
            <p className="mt-1 text-sm text-slate-400">Create, edit, complete, and sync tasks without storing sensitive client material offline.</p>
          </div>
          {pendingCount ? (
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100">
              {pendingCount} pending sync
            </span>
          ) : (
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
              Sync completed state
            </span>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {tasks.length ? tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {task.matterReferenceSnapshot || "Personal task"} · Due {formatDueDate(task.dueDate)} · {task.assignedToUserName}
                  </p>
                  {task.safeDescription ? <p className="mt-2 text-sm text-slate-300">{task.safeDescription}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">{task.status === "OPEN" ? "To do" : formatEnum(task.status)}</span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">{formatEnum(task.priority)}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs ${task.syncStatus === "PENDING" ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : task.conflictStatus !== "NONE" ? "border-rose-400/20 bg-rose-400/10 text-rose-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}>
                    {task.conflictStatus !== "NONE" ? "Conflict warning" : task.syncStatus === "PENDING" ? "Pending sync" : "Synced"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => openEdit(task)} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white">
                  Edit
                </button>
                <button type="button" onClick={() => void markDone(task)} disabled={task.status === "DONE"} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                  Complete
                </button>
              </div>
            </div>
          )) : (
            <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">No tasks yet. Create your first safe offline-friendly task.</p>
          )}
        </div>
      </section>
    </div>
  );
}
