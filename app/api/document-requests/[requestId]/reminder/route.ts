import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, canAccessMatter } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { refreshDocumentRequestAccess, sendDocumentRequestReminder } from "@/lib/services/client-workflows";
import { sendClientWorkflowEmail } from "@/lib/services/email";
import { serverLog } from "@/lib/services/runtime-config";

export async function POST(_: Request, { params }: { params: { requestId: string } }) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_send_client_requests")) {
      return NextResponse.json({ error: "You do not have permission to send reminders." }, { status: 403 });
    }

    const request = await prisma.documentRequest.findFirst({
      where: { id: params.requestId, workspaceId: context.workspace.id },
      include: { matter: { include: { assignedToUser: true, client: true } }, client: true, items: { include: { checklistItem: true } } }
    });
    if (!request || !canAccessMatter(context.user, request.matter)) {
      return NextResponse.json({ error: "Document request is not available for this user scope." }, { status: 403 });
    }

    const updated = await sendDocumentRequestReminder(request.id, context.user.id);
    const refreshed = await refreshDocumentRequestAccess(request.id);
    const emailDelivery = request.recipientEmail
      ? await sendClientWorkflowEmail({
          to: request.recipientEmail,
          recipientName: request.recipientName || `${request.client.firstName} ${request.client.lastName}`,
          workspaceName: context.workspace.name,
          subject: `${context.workspace.name}: reminder for requested migration documents`,
          intro: `This is a reminder that ${request.items.length} requested document item${request.items.length === 1 ? "" : "s"} still need attention.`,
          actionLabel: "Open secure upload link",
          actionLink: refreshed.url,
          footer: "If email delivery is not available, your migration team can share the secure upload link manually."
        })
      : { delivered: false, reason: "No recipient email is available.", actionLink: refreshed.url };

    return NextResponse.json({ request: updated, emailDelivery, link: refreshed.url });
  } catch (error) {
    serverLog("document_request.reminder_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to send a reminder right now." }, { status: 500 });
  }
}
