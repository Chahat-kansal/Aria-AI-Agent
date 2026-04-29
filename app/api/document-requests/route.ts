import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { createDocumentRequest } from "@/lib/services/client-workflows";
import { sendClientWorkflowEmail } from "@/lib/services/email";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  matterId: z.string().min(1),
  clientId: z.string().min(1),
  checklistItemIds: z.array(z.string().min(1)).min(1),
  dueDate: z.string().optional(),
  recipientName: z.string().trim().optional(),
  recipientEmail: z.string().trim().email().optional(),
  message: z.string().trim().optional()
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_send_client_requests")) {
      return NextResponse.json({ error: "You do not have permission to send document requests." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid document request details are required." }, { status: 400 });
    }

    const matter = await prisma.matter.findFirst({
      where: { id: parsed.data.matterId, workspaceId: context.workspace.id },
      include: { assignedToUser: true, client: true, checklistItems: true }
    });
    if (!matter || !canAccessMatter(context.user, matter)) {
      return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
    }

    const requestedItems = matter.checklistItems.filter((item) => parsed.data.checklistItemIds.includes(item.id));
    if (!requestedItems.length) {
      return NextResponse.json({ error: "Choose at least one checklist item to request." }, { status: 400 });
    }

    const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined;

    const result = await createDocumentRequest({
      workspaceId: context.workspace.id,
      matterId: matter.id,
      clientId: parsed.data.clientId,
      createdByUserId: context.user.id,
      checklistItemIds: parsed.data.checklistItemIds,
      dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : undefined,
      recipientName: parsed.data.recipientName || `${matter.client.firstName} ${matter.client.lastName}`,
      recipientEmail: parsed.data.recipientEmail || matter.client.email,
      message: parsed.data.message
    });

    const emailDelivery = (parsed.data.recipientEmail || matter.client.email)
      ? await sendClientWorkflowEmail({
          to: parsed.data.recipientEmail || matter.client.email,
          recipientName: parsed.data.recipientName || `${matter.client.firstName} ${matter.client.lastName}`,
          workspaceName: context.workspace.name,
          subject: `${context.workspace.name}: requested migration documents`,
          intro:
            parsed.data.message ||
            `Your migration team has requested ${requestedItems.length} document item${requestedItems.length === 1 ? "" : "s"} for review.`,
          actionLabel: "Upload requested documents",
          actionLink: result.url,
          footer: "Upload documents through this secure link. Review by your registered migration agent is still required."
        })
      : { delivered: false, reason: "No recipient email was available. Share the secure link manually.", actionLink: result.url };

    return NextResponse.json({ request: result.request, link: result.url, emailDelivery }, { status: 201 });
  } catch (error) {
    serverLog("document_request.create_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to create the document request right now." }, { status: 500 });
  }
}
