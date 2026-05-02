import { AssistantThreadStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { auditAccessDenied } from "@/lib/services/audit";
import { archiveAssistantThreadForUser, getAssistantThreadForUser, updateAssistantThreadForUser } from "@/lib/services/assistant-threads";
import { hasPermission } from "@/lib/services/roles";

function parseStatus(value: unknown) {
  if (typeof value !== "string") return undefined;
  return Object.values(AssistantThreadStatus).includes(value as AssistantThreadStatus)
    ? (value as AssistantThreadStatus)
    : undefined;
}

export async function GET(_: Request, { params }: { params: { threadId: string } }) {
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
      reason: "AI access disabled for thread detail."
    });
    return NextResponse.json({ error: "You do not have permission to use Aria AI." }, { status: 403 });
  }

  const thread = await getAssistantThreadForUser(params.threadId, context.user);
  if (!thread) {
    return NextResponse.json({ error: "That conversation is no longer available." }, { status: 404 });
  }

  return NextResponse.json({ thread });
}

export async function PATCH(req: Request, { params }: { params: { threadId: string } }) {
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
      reason: "AI access disabled for thread update."
    });
    return NextResponse.json({ error: "You do not have permission to use Aria AI." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const thread = await updateAssistantThreadForUser({
    threadId: params.threadId,
    user: context.user,
    title: typeof body.title === "string" ? body.title : undefined,
    status: parseStatus(body.status)
  });

  if (!thread) {
    return NextResponse.json({ error: "That conversation is no longer available." }, { status: 404 });
  }

  return NextResponse.json({ thread });
}

export async function DELETE(_: Request, { params }: { params: { threadId: string } }) {
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
      reason: "AI access disabled for thread archive."
    });
    return NextResponse.json({ error: "You do not have permission to use Aria AI." }, { status: 403 });
  }

  const thread = await archiveAssistantThreadForUser({
    threadId: params.threadId,
    user: context.user
  });

  if (!thread) {
    return NextResponse.json({ error: "That conversation is no longer available." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
