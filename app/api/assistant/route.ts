import { AssistantContextType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { auditAccessDenied } from "@/lib/services/audit";
import { createAssistantThreadForUser, sendAssistantThreadMessage } from "@/lib/services/assistant-threads";
import { hasPermission } from "@/lib/services/roles";

export async function POST(req: Request) {
  const context = await requireCurrentWorkspaceContext();

  if (!hasPermission(context.user, "can_access_ai")) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "AssistantThread",
      reason: "AI access disabled for assistant request."
    });
    return NextResponse.json({ error: "You do not have permission to use Aria AI." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const incomingThreadId = typeof body.threadId === "string" ? body.threadId : null;
  const matterId = typeof body.matterId === "string" ? body.matterId : null;

  if (!prompt) {
    return NextResponse.json({ error: "A message prompt is required." }, { status: 400 });
  }

  try {
    const threadId =
      incomingThreadId ||
      (
        await createAssistantThreadForUser({
          user: context.user,
          contextType: matterId ? AssistantContextType.MATTER : AssistantContextType.WORKSPACE,
          contextId: matterId
        })
      ).id;

    const result = await sendAssistantThreadMessage({
      threadId,
      prompt,
      user: context.user
    });

    return NextResponse.json({
      threadId: result.threadId,
      threadTitle: result.threadTitle,
      matterId: result.matterId,
      ...result.payload
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Aria could not complete that request right now." },
      { status: 500 }
    );
  }
}
