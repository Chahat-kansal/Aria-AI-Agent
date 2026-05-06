import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { approveMatterFormDraft, generateMatterFormDraft, publishApprovedFormToClient } from "@/lib/services/pdf-form-engine";
import { auditEvent } from "@/lib/services/audit";

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_edit_matters")) {
    return NextResponse.json({ error: "You do not have permission to generate matter form drafts." }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { matterId?: string; action?: "generate" | "approve" | "publish"; draftId?: string } | null;
  if (!body?.matterId) return NextResponse.json({ error: "matterId is required." }, { status: 400 });

  const matter = await prisma.matter.findFirst({
    where: { id: body.matterId, workspaceId: context.workspace.id },
    include: { assignedToUser: true }
  });
  if (!matter || !canAccessMatter(context.user, matter)) {
    return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
  }

  const action = body.action || "generate";
  if (action === "approve") {
    if (!body.draftId) return NextResponse.json({ error: "draftId is required to approve a form draft." }, { status: 400 });
    const draft = await approveMatterFormDraft(body.draftId, context.user.id);
    await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterOfficialFormDraft", entityId: draft.id, action: "approved" });
    return NextResponse.json({ ok: true, draft });
  }

  if (action === "publish") {
    if (!body.draftId) return NextResponse.json({ error: "draftId is required to publish a form draft." }, { status: 400 });
    const draft = await publishApprovedFormToClient(body.draftId);
    await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterOfficialFormDraft", entityId: draft.id, action: "published_to_client" });
    return NextResponse.json({ ok: true, draft });
  }

  const result = await generateMatterFormDraft({ matterId: body.matterId, templateId: params.templateId });
  if (!result.supported || !result.draft) {
    return NextResponse.json({ ok: false, reviewRequired: true, reason: result.reason }, { status: 409 });
  }
  await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterOfficialFormDraft", entityId: result.draft.id, action: "generated" });
  return NextResponse.json({ ok: true, reviewRequired: true, draft: result.draft, reviewRows: result.reviewRows });
}
