import { Prisma, TaskConflictStatus, TaskPriority, TaskStatus, TaskSyncStatus, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { sendPush } from "@/lib/services/push/send-push";
import { canAccessMatter, hasPermission, hasTeamOversight, scopedMatterWhere } from "@/lib/services/roles";
import { assertOfflineSafeContent } from "@/lib/services/offline/offline-policy";
import { evaluateOfflineNoteSafety } from "@/lib/services/offline/offline-note-safety";
import { redactOfflineMetadata, redactOfflinePreview } from "@/lib/services/offline/offline-redaction";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

export const taskCreateSchema = z.object({
  matterId: z.string().trim().optional().nullable(),
  matterReferenceSnapshot: z.string().trim().max(80).optional().nullable(),
  assignedToUserId: z.string().trim().min(1),
  title: z.string().trim().min(3).max(160),
  safeDescription: z.string().trim().max(800).optional().nullable(),
  dueDate: z.string().min(1),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.OPEN),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  category: z.string().trim().max(80).optional().nullable(),
  offlineCreatedAt: z.string().optional().nullable()
});

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  baseUpdatedAt: z.string().min(1),
  conflictStrategy: z.enum(["keep_local", "keep_server", "merge_safe"]).optional()
});

export const taskSyncOperationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["create", "update", "complete"]),
  taskId: z.string().min(1),
  serverId: z.string().optional().nullable(),
  baseUpdatedAt: z.string().optional().nullable(),
  payload: z.record(z.any())
});

export type TaskListItem = Awaited<ReturnType<typeof listTasksForUser>>[number];

function taskInclude() {
  return {
    assignedToUser: { select: { id: true, name: true, email: true, supervisorId: true } },
    createdByUser: { select: { id: true, name: true, email: true } },
    matter: {
      include: {
        client: { select: { firstName: true, lastName: true } },
        assignedToUser: { select: { id: true, supervisorId: true } }
      }
    }
  } satisfies Prisma.TaskInclude;
}

export function getScopedTaskWhere(user: ScopedUser): Prisma.TaskWhereInput {
  if (hasPermission(user, "can_view_all_matters")) {
    return { workspaceId: user.workspaceId };
  }

  const matterScope = scopedMatterWhere(user);
  if (hasTeamOversight(user)) {
    return {
      workspaceId: user.workspaceId,
      OR: [
        { matter: matterScope },
        { matterId: null, assignedToUserId: user.id },
        { matterId: null, assignedToUser: { supervisorId: user.id } },
        { matterId: null, createdByUserId: user.id }
      ]
    };
  }

  return {
    workspaceId: user.workspaceId,
    OR: [
      { matter: matterScope },
      { matterId: null, assignedToUserId: user.id },
      { matterId: null, createdByUserId: user.id }
    ]
  };
}

async function assertTaskPermission(user: ScopedUser, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId: user.workspaceId },
    include: taskInclude()
  });

  if (!task) {
    throw new Error("TASK_NOT_FOUND");
  }

  if (task.matter) {
    if (!canAccessMatter(user, task.matter)) {
      throw new Error("TASK_SCOPE_DENIED");
    }
  } else if (
    task.assignedToUserId !== user.id &&
    task.createdByUserId !== user.id &&
    !(hasTeamOversight(user) && task.assignedToUser?.supervisorId === user.id) &&
    !hasPermission(user, "can_view_all_matters")
  ) {
    throw new Error("TASK_SCOPE_DENIED");
  }

  return task;
}

async function assertAssignableUser(workspaceId: string, actor: ScopedUser, assignedToUserId: string) {
  if (assignedToUserId === actor.id) return;
  if (!hasPermission(actor, "can_manage_team")) {
    throw new Error("ASSIGNEE_SCOPE_DENIED");
  }

  const assignee = await prisma.user.findFirst({
    where: { id: assignedToUserId, workspaceId, status: { not: "DISABLED" } },
    select: { id: true }
  });
  if (!assignee) {
    throw new Error("ASSIGNEE_NOT_FOUND");
  }
}

async function resolveMatterSnapshot(workspaceId: string, actor: ScopedUser, matterId?: string | null) {
  if (!matterId) return { matterId: null, matterReferenceSnapshot: null };

  const matter = await prisma.matter.findFirst({
    where: { id: matterId, workspaceId },
    include: { assignedToUser: { select: { supervisorId: true } }, client: true }
  });

  if (!matter || !canAccessMatter(actor, matter)) {
    throw new Error("MATTER_SCOPE_DENIED");
  }

  return {
    matterId: matter.id,
    matterReferenceSnapshot: matter.matterReference
  };
}

function normalizeTaskInput(input: z.infer<typeof taskCreateSchema>) {
  const safeNote = evaluateOfflineNoteSafety(input.safeDescription);
  if (!safeNote.allowed) {
    throw new Error("SENSITIVE_OFFLINE_CONTENT");
  }

  const dueDate = new Date(input.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    throw new Error("INVALID_DUE_DATE");
  }

  return {
    title: input.title.trim(),
    safeDescription: safeNote.sanitized || null,
    description: safeNote.sanitized || "",
    dueDate
  };
}

async function notifyTaskAttention(workspaceId: string, userId: string, eventType: string) {
  await sendPush({
    workspaceId,
    userId,
    title: "Aria",
    body: "You have a task requiring attention. Open Aria to review.",
    route: "/app/tasks",
    isAgentAlert: true,
    eventType
  }).catch(() => null);
}

export async function listTasksForUser(workspaceId: string, user: ScopedUser) {
  return prisma.task.findMany({
    where: { workspaceId, ...getScopedTaskWhere(user) },
    include: taskInclude(),
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 200
  });
}

export function serializeTaskForClient(task: any) {
  return {
    id: task.id,
    title: task.title,
    safeDescription: task.safeDescription ?? null,
    dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : String(task.dueDate),
    status: task.status,
    priority: task.priority,
    category: task.category ?? null,
    matterId: task.matterId ?? null,
    matterReferenceSnapshot: task.matterReferenceSnapshot ?? null,
    assignedToUserId: task.assignedToUserId,
    assignedToUserName: task.assignedToUser?.name ?? task.assignedToUser?.email ?? "Assigned user",
    createdByUserId: task.createdByUserId ?? null,
    createdByUserName: task.createdByUser?.name ?? task.createdByUser?.email ?? null,
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : String(task.updatedAt),
    lastSyncedAt: task.lastSyncedAt instanceof Date ? task.lastSyncedAt.toISOString() : task.lastSyncedAt ? String(task.lastSyncedAt) : null,
    syncStatus: task.syncStatus,
    conflictStatus: task.conflictStatus
  };
}

export async function createTask(input: {
  workspaceId: string;
  actor: ScopedUser;
  data: z.infer<typeof taskCreateSchema>;
}) {
  if (!hasPermission(input.actor, "can_edit_matters")) {
    throw new Error("TASK_CREATE_DENIED");
  }

  await assertAssignableUser(input.workspaceId, input.actor, input.data.assignedToUserId);
  const matter = await resolveMatterSnapshot(input.workspaceId, input.actor, input.data.matterId);
  let normalized: ReturnType<typeof normalizeTaskInput>;
  try {
    normalized = normalizeTaskInput(input.data);
  } catch (error) {
    if (error instanceof Error && error.message === "SENSITIVE_OFFLINE_CONTENT") {
      await auditEvent({
        workspaceId: input.workspaceId,
        userId: input.actor.id,
        entityType: "Task",
        action: "offline.sensitive_content_blocked",
        metadata: { title: redactOfflinePreview(input.data.title) }
      });
    }
    throw error;
  }

  const task = await prisma.task.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: matter.matterId,
      matterReferenceSnapshot: input.data.matterReferenceSnapshot?.trim() || matter.matterReferenceSnapshot,
      assignedToUserId: input.data.assignedToUserId,
      createdByUserId: input.actor.id,
      title: normalized.title,
      description: normalized.description,
      safeDescription: normalized.safeDescription,
      dueDate: normalized.dueDate,
      status: input.data.status,
      priority: input.data.priority,
      category: input.data.category?.trim() || null,
      offlineCreatedAt: input.data.offlineCreatedAt ? new Date(input.data.offlineCreatedAt) : null,
      lastSyncedAt: new Date(),
      syncStatus: TaskSyncStatus.SYNCED,
      conflictStatus: TaskConflictStatus.NONE
    },
    include: taskInclude()
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.actor.id,
    entityType: "Task",
    entityId: task.id,
    action: "offline.task_created",
    metadata: redactOfflineMetadata({
      assignedToUserId: task.assignedToUserId,
      matterId: task.matterId,
      priority: task.priority,
      status: task.status
    }) as Prisma.InputJsonObject
  });

  if (task.assignedToUserId) {
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.actor.id,
      entityType: "Task",
      entityId: task.id,
      action: "task.assigned",
      metadata: { assignedToUserId: task.assignedToUserId }
    });
    await notifyTaskAttention(input.workspaceId, task.assignedToUserId, "task.assigned");
  }

  return task;
}

export async function updateTask(input: {
  workspaceId: string;
  actor: ScopedUser;
  taskId: string;
  data: z.infer<typeof taskUpdateSchema>;
}) {
  if (!hasPermission(input.actor, "can_edit_matters")) {
    throw new Error("TASK_UPDATE_DENIED");
  }

  const existing = await assertTaskPermission(input.actor, input.taskId);
  const baseUpdatedAt = new Date(input.data.baseUpdatedAt);
  if (existing.updatedAt.toISOString() !== baseUpdatedAt.toISOString()) {
    return {
      ok: false as const,
      conflict: true as const,
      task: existing
    };
  }

  const assignedToUserId = input.data.assignedToUserId || existing.assignedToUserId;
  await assertAssignableUser(input.workspaceId, input.actor, assignedToUserId);
  const matter = await resolveMatterSnapshot(input.workspaceId, input.actor, input.data.matterId ?? existing.matterId);
  let normalized: ReturnType<typeof normalizeTaskInput>;
  try {
    normalized = normalizeTaskInput({
      matterId: matter.matterId,
      matterReferenceSnapshot: input.data.matterReferenceSnapshot ?? existing.matterReferenceSnapshot,
      assignedToUserId,
      title: input.data.title ?? existing.title,
      safeDescription: input.data.safeDescription ?? existing.safeDescription,
      dueDate: input.data.dueDate ?? existing.dueDate.toISOString(),
      status: input.data.status ?? existing.status,
      priority: input.data.priority ?? existing.priority,
      category: input.data.category ?? existing.category,
      offlineCreatedAt: null
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SENSITIVE_OFFLINE_CONTENT") {
      await auditEvent({
        workspaceId: input.workspaceId,
        userId: input.actor.id,
        entityType: "Task",
        entityId: existing.id,
        action: "offline.sensitive_content_blocked",
        metadata: { title: redactOfflinePreview(input.data.title ?? existing.title) }
      });
    }
    throw error;
  }

  const updated = await prisma.task.update({
    where: { id: existing.id },
    data: {
      matterId: matter.matterId,
      matterReferenceSnapshot: input.data.matterReferenceSnapshot?.trim() || matter.matterReferenceSnapshot || existing.matterReferenceSnapshot,
      assignedToUserId,
      title: normalized.title,
      description: normalized.description,
      safeDescription: normalized.safeDescription,
      dueDate: normalized.dueDate,
      status: input.data.status ?? existing.status,
      priority: input.data.priority ?? existing.priority,
      category: input.data.category?.trim() || existing.category,
      lastSyncedAt: new Date(),
      syncStatus: TaskSyncStatus.SYNCED,
      conflictStatus: TaskConflictStatus.NONE
    },
    include: taskInclude()
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.actor.id,
    entityType: "Task",
    entityId: updated.id,
    action: "offline.task_updated",
    metadata: redactOfflineMetadata({
      assignedToUserId: updated.assignedToUserId,
      matterId: updated.matterId,
      priority: updated.priority,
      status: updated.status,
      safeDescription: redactOfflinePreview(updated.safeDescription)
    }) as Prisma.InputJsonObject
  });

  if (updated.assignedToUserId !== existing.assignedToUserId) {
    await notifyTaskAttention(input.workspaceId, updated.assignedToUserId, "task.assigned");
  }

  if (updated.status === TaskStatus.DONE) {
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.actor.id,
      entityType: "Task",
      entityId: updated.id,
      action: "offline.task_completed",
      metadata: { assignedToUserId: updated.assignedToUserId }
    });
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.actor.id,
      entityType: "Task",
      entityId: updated.id,
      action: "task.completed",
      metadata: { assignedToUserId: updated.assignedToUserId }
    });
  }

  return {
    ok: true as const,
    conflict: false as const,
    task: updated
  };
}

export async function completeTask(input: {
  workspaceId: string;
  actor: ScopedUser;
  taskId: string;
  baseUpdatedAt: string;
}) {
  return updateTask({
    workspaceId: input.workspaceId,
    actor: input.actor,
    taskId: input.taskId,
    data: {
      baseUpdatedAt: input.baseUpdatedAt,
      status: TaskStatus.DONE
    }
  });
}

export async function syncOfflineTaskOperations(input: {
  workspaceId: string;
  actor: ScopedUser;
  operations: Array<z.infer<typeof taskSyncOperationSchema>>;
}) {
  const results: Array<Record<string, unknown>> = [];
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.actor.id,
    entityType: "Task",
    action: "offline.sync_started",
    metadata: { operationCount: input.operations.length }
  });

  for (const operation of input.operations) {
    try {
      if (operation.type === "create") {
        const created = await createTask({
          workspaceId: input.workspaceId,
          actor: input.actor,
          data: taskCreateSchema.parse(operation.payload)
        });
        results.push({ operationId: operation.id, ok: true, type: operation.type, taskId: created.id, task: created });
        continue;
      }

      if (!operation.serverId) {
        results.push({ operationId: operation.id, ok: false, type: operation.type, error: "Missing server task id." });
        continue;
      }

      if (operation.type === "complete") {
        const completed = await completeTask({
          workspaceId: input.workspaceId,
          actor: input.actor,
          taskId: operation.serverId,
          baseUpdatedAt: operation.baseUpdatedAt || new Date(0).toISOString()
        });
        results.push({ operationId: operation.id, ...completed, type: operation.type, taskId: operation.serverId });
        continue;
      }

      const updated = await updateTask({
        workspaceId: input.workspaceId,
        actor: input.actor,
        taskId: operation.serverId,
        data: taskUpdateSchema.parse({
          ...operation.payload,
          baseUpdatedAt: operation.baseUpdatedAt || new Date(0).toISOString()
        })
      });

      results.push({ operationId: operation.id, ...updated, type: operation.type, taskId: operation.serverId });
    } catch (error) {
      results.push({
        operationId: operation.id,
        ok: false,
        type: operation.type,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const hasConflict = results.some((result) => result.conflict === true);
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.actor.id,
    entityType: "Task",
    action: hasConflict ? "offline.conflict_detected" : "offline.sync_completed",
    metadata: { operationCount: input.operations.length, hasConflict }
  });

  return {
    ok: !results.some((result) => result.ok === false && result.conflict !== true),
    hasConflict,
    results
  };
}
