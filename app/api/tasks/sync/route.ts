import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { serializeTaskForClient, syncOfflineTaskOperations, taskSyncOperationSchema } from "@/lib/services/offline/offline-task-sync";

const syncSchema = z.object({
  operations: z.array(taskSyncOperationSchema).max(100)
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    const parsed = syncSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid offline task operations are required." }, { status: 400 });
    }

    const result = await syncOfflineTaskOperations({
      workspaceId: context.workspace.id,
      actor: context.user,
      operations: parsed.data.operations
    });

    return NextResponse.json({
      ...result,
      results: result.results.map((entry: any) => ({
        ...entry,
        task: entry.task ? serializeTaskForClient(entry.task) : undefined
      }))
    }, { status: result.ok ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Authenticated workspace context is required.") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to sync offline tasks right now." }, { status: 500 });
  }
}
