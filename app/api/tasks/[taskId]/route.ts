import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { completeTask, serializeTaskForClient, taskUpdateSchema, updateTask } from "@/lib/services/offline/offline-task-sync";

const completeSchema = z.object({
  baseUpdatedAt: z.string().min(1)
});

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Authenticated workspace context is required.") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (message === "TASK_NOT_FOUND") {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  if (message === "TASK_SCOPE_DENIED" || message === "TASK_UPDATE_DENIED" || message === "ASSIGNEE_SCOPE_DENIED" || message === "MATTER_SCOPE_DENIED") {
    return NextResponse.json({ error: "This task is outside your current workspace scope." }, { status: 403 });
  }
  if (message === "SENSITIVE_OFFLINE_CONTENT") {
    return NextResponse.json({ error: "Sensitive notes require internet connection." }, { status: 400 });
  }
  if (message === "INVALID_DUE_DATE") {
    return NextResponse.json({ error: "A valid due date is required." }, { status: 400 });
  }
  return NextResponse.json({ error: "Unable to update the task right now." }, { status: 500 });
}

export async function PATCH(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const context = await requireCurrentWorkspaceContext();
    const body = await req.json().catch(() => null);

    if (body?.action === "complete") {
      const parsedComplete = completeSchema.safeParse(body);
      if (!parsedComplete.success) {
        return NextResponse.json({ error: "A sync base timestamp is required." }, { status: 400 });
      }

      const result = await completeTask({
        workspaceId: context.workspace.id,
        actor: context.user,
        taskId: params.taskId,
        baseUpdatedAt: parsedComplete.data.baseUpdatedAt
      });

      if (result.conflict) {
        return NextResponse.json({ error: "Task conflict detected.", conflict: true, task: serializeTaskForClient(result.task) }, { status: 409 });
      }

      return NextResponse.json({ task: serializeTaskForClient(result.task) });
    }

    const parsed = taskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid task changes are required." }, { status: 400 });
    }

    const result = await updateTask({
      workspaceId: context.workspace.id,
      actor: context.user,
      taskId: params.taskId,
      data: parsed.data
    });

    if (result.conflict) {
      return NextResponse.json({ error: "Task conflict detected.", conflict: true, task: serializeTaskForClient(result.task) }, { status: 409 });
    }

    return NextResponse.json({ task: serializeTaskForClient(result.task) });
  } catch (error) {
    return errorResponse(error);
  }
}
