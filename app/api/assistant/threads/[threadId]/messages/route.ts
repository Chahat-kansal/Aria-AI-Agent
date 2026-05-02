import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { auditAccessDenied } from "@/lib/services/audit";
import { sendAssistantThreadMessage } from "@/lib/services/assistant-threads";
import { hasPermission } from "@/lib/services/roles";

export async function POST(req: Request, { params }: { params: { threadId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!hasPermission(context.user, "can_access_ai")) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "AssistantThread",
      entityId: params.threadId,
      reason: "AI access disabled for message send."
    });
    return NextResponse.json({ error: "You do not have permission to use Aria AI." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return NextResponse.json({ error: "A message prompt is required." }, { status: 400 });
  }

  try {
    const result = await sendAssistantThreadMessage({
      threadId: params.threadId,
      prompt: body.prompt,
      user: context.user
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aria could not complete that request right now.";
    const status = /no longer available/i.test(message) ? 404 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
