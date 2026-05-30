import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import {
  getMatterEmailWorkspace,
  importMatterEmailThreadMessages,
  linkMatterEmailThread,
  sendMatterClientEmail,
  unlinkMatterEmailThread
} from "@/lib/services/email-sync/matter-email-linking";

const threadSchema = z.object({
  externalThreadId: z.string().min(1),
  externalMessageId: z.string().optional().nullable(),
  subjectPreview: z.string().min(1),
  fromPreview: z.string().min(1),
  toPreview: z.array(z.string()).default([]),
  lastMessageAt: z.string().datetime().nullable().optional(),
  messageCount: z.number().int().min(1)
});

const emailActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link_thread"),
    thread: threadSchema.transform((thread) => ({
      ...thread,
      lastMessageAt: thread.lastMessageAt ?? null
    }))
  }),
  z.object({
    action: z.literal("unlink_thread"),
    threadId: z.string().min(1)
  }),
  z.object({
    action: z.literal("import_thread"),
    threadId: z.string().min(1)
  }),
  z.object({
    action: z.literal("send_email"),
    template: z.enum([
      "document_request",
      "confirmation_request",
      "appointment_reminder",
      "portal_invite_reminder",
      "general_follow_up"
    ]),
    subject: z.string().trim().optional().nullable(),
    bodyText: z.string().trim().optional().nullable(),
    confirmSensitiveContent: z.boolean().optional(),
    requestOrigin: z.string().trim().optional().nullable()
  })
]);

export async function GET(_: Request, { params }: { params: { matterId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  const workspace = await getMatterEmailWorkspace({
    workspaceId: context.workspace.id,
    matterId: params.matterId,
    user: context.user
  });

  if (!workspace) {
    return NextResponse.json({ error: "Matter email workspace is not available for this user scope." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, workspace });
}

export async function POST(request: Request, { params }: { params: { matterId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  const parsed = emailActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email sync action details are required." }, { status: 400 });
  }

  const input = parsed.data;

  if (input.action === "link_thread") {
    const result = await linkMatterEmailThread({
      workspaceId: context.workspace.id,
      matterId: params.matterId,
      user: context.user,
      thread: input.thread
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  }

  if (input.action === "unlink_thread") {
    const result = await unlinkMatterEmailThread({
      workspaceId: context.workspace.id,
      matterId: params.matterId,
      user: context.user,
      threadId: input.threadId
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  }

  if (input.action === "import_thread") {
    const result = await importMatterEmailThreadMessages({
      workspaceId: context.workspace.id,
      matterId: params.matterId,
      user: context.user,
      threadId: input.threadId
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  }

  const result = await sendMatterClientEmail({
    workspaceId: context.workspace.id,
    matterId: params.matterId,
    user: context.user,
    template: input.template,
    subject: input.subject,
    bodyText: input.bodyText,
    confirmSensitiveContent: input.confirmSensitiveContent,
    requestOrigin: input.requestOrigin
  });

  if (!result.ok && result.warning) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
