import { AssistantContextType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { auditAccessDenied } from "@/lib/services/audit";
import { createAssistantThreadForUser, listAssistantThreadsForUser } from "@/lib/services/assistant-threads";
import { hasPermission } from "@/lib/services/roles";

function parseContextType(value: unknown) {
  if (typeof value !== "string") return undefined;
  return Object.values(AssistantContextType).includes(value as AssistantContextType)
    ? (value as AssistantContextType)
    : undefined;
}

export async function GET() {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_access_ai")) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "AssistantThread",
      reason: "AI access disabled for thread listing."
    });
    return NextResponse.json({ error: "You do not have permission to use Aria AI." }, { status: 403 });
  }

  const threads = await listAssistantThreadsForUser(context.user);
  return NextResponse.json({ threads });
}

export async function POST(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_access_ai")) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "AssistantThread",
      reason: "AI access disabled for thread creation."
    });
    return NextResponse.json({ error: "You do not have permission to use Aria AI." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const thread = await createAssistantThreadForUser({
      user: context.user,
      title: typeof body.title === "string" ? body.title : undefined,
      contextType: parseContextType(body.contextType),
      contextId: typeof body.contextId === "string" ? body.contextId : undefined
    });

    return NextResponse.json({ thread }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create a new conversation right now." },
      { status: 400 }
    );
  }
}
