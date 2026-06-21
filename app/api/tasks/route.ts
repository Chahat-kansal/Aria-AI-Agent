import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { createTask, listTasksForUser, serializeTaskForClient, taskCreateSchema } from "@/lib/services/offline/offline-task-sync";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Authenticated workspace context is required.") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (message === "TASK_CREATE_DENIED") {
    return NextResponse.json({ error: "You do not have permission to create tasks." }, { status: 403 });
  }
  if (message === "MATTER_SCOPE_DENIED" || message === "ASSIGNEE_SCOPE_DENIED") {
    return NextResponse.json({ error: "This task is outside your current workspace scope." }, { status: 403 });
  }
  if (message === "SENSITIVE_OFFLINE_CONTENT") {
    return NextResponse.json({ error: "Sensitive notes require internet connection." }, { status: 400 });
  }
  if (message === "INVALID_DUE_DATE") {
    return NextResponse.json({ error: "A valid due date is required." }, { status: 400 });
  }
  return NextResponse.json({ error: "Unable to save the task right now." }, { status: 500 });
}

export async function GET() {
  try {
    const context = await requireCurrentWorkspaceContext();
    const tasks = await listTasksForUser(context.workspace.id, context.user);
    return NextResponse.json({ tasks: tasks.map(serializeTaskForClient) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    const parsed = taskCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid task details are required." }, { status: 400 });
    }

    const task = await createTask({
      workspaceId: context.workspace.id,
      actor: context.user,
      data: parsed.data
    });

    return NextResponse.json({ task: serializeTaskForClient(task) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
