import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, scopedClientWhere, canAccessMatter } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { createClientIntakeRequest } from "@/lib/services/client-workflows";
import { sendClientWorkflowEmail } from "@/lib/services/email";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  title: z.string().trim().min(2),
  clientId: z.string().optional(),
  matterId: z.string().optional(),
  recipientName: z.string().trim().optional(),
  recipientEmail: z.string().trim().email().optional(),
  message: z.string().trim().optional()
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_send_client_requests")) {
      return NextResponse.json({ error: "You do not have permission to send client intake requests." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid intake request details are required." }, { status: 400 });
    }

    let clientId = parsed.data.clientId;
    let matterId = parsed.data.matterId;
    let recipientName = parsed.data.recipientName;
    let recipientEmail = parsed.data.recipientEmail;

    if (matterId) {
      const matter = await prisma.matter.findFirst({
        where: { id: matterId, workspaceId: context.workspace.id },
        include: { assignedToUser: true, client: true }
      });
      if (!matter || !canAccessMatter(context.user, matter)) {
        return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
      }
      clientId = matter.clientId;
      recipientName ||= `${matter.client.firstName} ${matter.client.lastName}`;
      recipientEmail ||= matter.client.email;
    } else if (clientId) {
      const client = await prisma.client.findFirst({ where: { id: clientId, ...scopedClientWhere(context.user) } });
      if (!client) return NextResponse.json({ error: "Client is not available for this user scope." }, { status: 403 });
      recipientName ||= `${client.firstName} ${client.lastName}`;
      recipientEmail ||= client.email;
    }

    const result = await createClientIntakeRequest({
      workspaceId: context.workspace.id,
      createdByUserId: context.user.id,
      clientId,
      matterId,
      title: parsed.data.title,
      recipientName,
      recipientEmail,
      message: parsed.data.message
    });

    const emailDelivery = recipientEmail
      ? await sendClientWorkflowEmail({
          to: recipientEmail,
          recipientName: recipientName || "Client",
          workspaceName: context.workspace.name,
          subject: `${context.workspace.name}: intake request`,
          intro: parsed.data.message || "Your migration team has requested an intake questionnaire so they can review your matter and next steps.",
          actionLabel: "Complete intake questionnaire",
          actionLink: result.url,
          footer: "This intake is part of an AI-assisted workflow. A registered migration agent will review the submitted information."
        })
      : { delivered: false, reason: "No recipient email was available. Share the secure link manually.", actionLink: result.url };

    return NextResponse.json({ request: result.request, link: result.url, emailDelivery }, { status: 201 });
  } catch (error) {
    serverLog("intake.create_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to create the intake request right now." }, { status: 500 });
  }
}
