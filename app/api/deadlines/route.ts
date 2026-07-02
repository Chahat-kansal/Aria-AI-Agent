import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import {
  completeDeadline,
  createDeadline,
  deadlineCreateSchema,
  deadlineUpdateSchema,
  getDeadlineReminderPreview,
  sendReminderForDeadlineItem,
  updateDeadline
} from "@/lib/services/deadlines/deadline-service";

const createSchema = deadlineCreateSchema.extend({
  action: z.literal("create")
});

const updateSchema = deadlineUpdateSchema.extend({
  action: z.literal("update")
});

const completeSchema = z.object({
  action: z.literal("complete"),
  deadlineId: z.string().min(1)
});

const previewSchema = z.object({
  action: z.literal("preview"),
  itemId: z.string().min(1),
  channel: z.enum(["agent_push", "portal", "email"]).optional().nullable()
});

const sendReminderSchema = z.object({
  action: z.literal("send_reminder"),
  itemId: z.string().min(1),
  channel: z.enum(["agent_push", "portal", "email"]).optional().nullable()
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    const body = await req.json().catch(() => null);
    const candidates = [
      createSchema.safeParse(body),
      updateSchema.safeParse(body),
      completeSchema.safeParse(body),
      previewSchema.safeParse(body),
      sendReminderSchema.safeParse(body)
    ];
    const parsed = candidates.find((candidate) => candidate.success);
    if (!parsed || !parsed.success) {
      return NextResponse.json({ error: "Valid deadline details are required." }, { status: 400 });
    }

    if (parsed.data.action === "create") {
      const deadline = await createDeadline({
        workspaceId: context.workspace.id,
        actor: context.user,
        data: parsed.data
      });
      return NextResponse.json({ ok: true, deadlineId: deadline.id });
    }

    if (parsed.data.action === "update") {
      const deadline = await updateDeadline({
        workspaceId: context.workspace.id,
        actor: context.user,
        data: parsed.data
      });
      return NextResponse.json({ ok: true, deadlineId: deadline.id });
    }

    if (parsed.data.action === "complete") {
      const deadline = await completeDeadline({
        workspaceId: context.workspace.id,
        actor: context.user,
        deadlineId: parsed.data.deadlineId
      });
      return NextResponse.json({ ok: true, deadlineId: deadline.id });
    }

    if (parsed.data.action === "preview") {
      const result = await getDeadlineReminderPreview({
        workspaceId: context.workspace.id,
        user: context.user,
        itemId: parsed.data.itemId,
        channel: parsed.data.channel || null
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await sendReminderForDeadlineItem({
      workspaceId: context.workspace.id,
      user: context.user,
      itemId: parsed.data.itemId,
      channel: parsed.data.channel || null
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Authenticated workspace context is required.") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (
      [
        "DEADLINE_ACCESS_DENIED",
        "DEADLINE_CREATE_DENIED",
        "DEADLINE_UPDATE_DENIED",
        "DEADLINE_COMPLETE_DENIED",
        "DEADLINE_REMINDER_DENIED",
        "DEADLINE_SCOPE_DENIED",
        "DEADLINE_MATTER_SCOPE_DENIED",
        "DEADLINE_ASSIGNMENT_DENIED"
      ].includes(message)
    ) {
      return NextResponse.json({ error: "You do not have permission to manage these deadlines." }, { status: 403 });
    }
    if (["DEADLINE_NOT_FOUND", "DEADLINE_ITEM_NOT_FOUND"].includes(message)) {
      return NextResponse.json({ error: "Deadline not found." }, { status: 404 });
    }
    if (message === "DEADLINE_INVALID_DUE_DATE") {
      return NextResponse.json({ error: "A valid deadline date is required." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to complete the deadline action right now." }, { status: 500 });
  }
}
