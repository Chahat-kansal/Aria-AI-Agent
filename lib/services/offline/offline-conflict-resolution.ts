export type OfflineTaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "BLOCKED";
export type OfflineTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type OfflineTaskSyncStatus = "SYNCED" | "PENDING" | "CONFLICT" | "ERROR";
export type OfflineTaskConflictStatus = "NONE" | "LOCAL_NEWER" | "SERVER_NEWER" | "MERGE_REQUIRED";

export type ConflictTaskSnapshot = {
  id: string;
  title: string;
  safeDescription: string | null;
  dueDate: string;
  status: OfflineTaskStatus;
  priority: OfflineTaskPriority;
  matterId: string | null;
  matterReferenceSnapshot: string | null;
  assignedToUserId: string;
  updatedAt: string;
  syncStatus: OfflineTaskSyncStatus;
  conflictStatus: OfflineTaskConflictStatus;
};

export type ConflictResolutionStrategy = "keep_local" | "keep_server" | "merge_safe";

export type ConflictResolutionResult = {
  resolved: ConflictTaskSnapshot;
  syncStatus: OfflineTaskSyncStatus;
  conflictStatus: OfflineTaskConflictStatus;
};

export function resolveTaskConflict(
  localTask: ConflictTaskSnapshot,
  serverTask: ConflictTaskSnapshot,
  strategy: ConflictResolutionStrategy
): ConflictResolutionResult {
  if (strategy === "keep_server") {
    return {
      resolved: serverTask,
      syncStatus: "SYNCED" satisfies OfflineTaskSyncStatus,
      conflictStatus: "NONE" satisfies OfflineTaskConflictStatus
    };
  }

  if (strategy === "keep_local") {
    return {
      resolved: {
        ...localTask,
        syncStatus: "PENDING" satisfies OfflineTaskSyncStatus,
        conflictStatus: "NONE" satisfies OfflineTaskConflictStatus
      },
      syncStatus: "PENDING" satisfies OfflineTaskSyncStatus,
      conflictStatus: "NONE" satisfies OfflineTaskConflictStatus
    };
  }

  return {
    resolved: {
      ...serverTask,
      title: localTask.title || serverTask.title,
      safeDescription: localTask.safeDescription || serverTask.safeDescription,
      dueDate: localTask.dueDate || serverTask.dueDate,
      status: localTask.status === "DONE" ? "DONE" : serverTask.status,
      priority: localTask.priority || serverTask.priority,
      matterId: localTask.matterId ?? serverTask.matterId,
      matterReferenceSnapshot: localTask.matterReferenceSnapshot ?? serverTask.matterReferenceSnapshot,
      assignedToUserId: localTask.assignedToUserId || serverTask.assignedToUserId,
      syncStatus: "PENDING" satisfies OfflineTaskSyncStatus,
      conflictStatus: "NONE" satisfies OfflineTaskConflictStatus
    },
    syncStatus: "PENDING" satisfies OfflineTaskSyncStatus,
    conflictStatus: "NONE" satisfies OfflineTaskConflictStatus
  };
}
