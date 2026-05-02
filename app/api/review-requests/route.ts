import { NextResponse } from "next/server";
import { createClientReviewRequest } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const matterId = typeof body.matterId === "string" ? body.matterId : null;
  const draftId = typeof body.draftId === "string" ? body.draftId : null;
  if (!matterId || !draftId) return NextResponse.json({ error: "matterId and draftId are required" }, { status: 400 });
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
  if (!hasPermission(context.user, "can_edit_matters")) return NextResponse.json({ error: "You do not have permission to send client review requests." }, { status: 403 });
  const matter = await prisma.matter.findFirst({ where: { id: matterId, workspaceId: context.workspace.id }, include: { assignedToUser: true } });
  if (!matter || !canAccessMatter(context.user, matter)) return NextResponse.json({ error: "You do not have access to this matter." }, { status: 403 });

  const result = await createClientReviewRequest({
    matterId,
    draftId,
    recipientName: typeof body.recipientName === "string" ? body.recipientName : undefined,
    recipientEmail: typeof body.recipientEmail === "string" ? body.recipientEmail : undefined,
    message: typeof body.message === "string" ? body.message : undefined
  });

  return NextResponse.json({
    status: "sent_to_client",
    reviewRequired: true,
    message: "Client review request recorded. Share the secure client review link if email delivery is not configured.",
    request: result.request,
    reviewUrl: result.reviewUrl
  });
}
