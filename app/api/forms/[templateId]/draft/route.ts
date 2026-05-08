import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { assessMatterCaseSafety } from "@/lib/services/case-safety";
import { approveMatterFormDraft, generateMatterFormDraft, publishApprovedFormToClient } from "@/lib/services/pdf-form-engine";
import { auditAccessDenied, auditEvent, auditMatterAction } from "@/lib/services/audit";
import { getWorkspaceLaunchControls, isSubclassAllowedByLaunchControls } from "@/lib/services/launch-controls";

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  const body = await req.json().catch(() => null) as { matterId?: string; action?: "generate" | "approve" | "publish"; draftId?: string } | null;
  if (!hasPermission(context.user, "can_edit_matters")) {
    await auditAccessDenied({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterOfficialFormDraft", entityId: body?.draftId ?? body?.matterId, reason: "form_draft_permission_missing" });
    return NextResponse.json({ error: "You do not have permission to generate matter form drafts." }, { status: 403 });
  }
  if (!body?.matterId) return NextResponse.json({ error: "matterId is required." }, { status: 400 });

  const matter = await prisma.matter.findFirst({
    where: { id: body.matterId, workspaceId: context.workspace.id },
    include: { assignedToUser: true }
  });
  if (!matter || !canAccessMatter(context.user, matter)) {
    await auditAccessDenied({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterOfficialFormDraft", entityId: body.matterId, reason: "form_draft_scope_denied" });
    return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
  }
  const launchControls = await getWorkspaceLaunchControls(context.workspace.id);
  if (!isSubclassAllowedByLaunchControls(launchControls, matter.visaSubclass)) {
    return NextResponse.json({ error: `Form drafting is disabled for Subclass ${matter.visaSubclass} by current launch controls.` }, { status: 409 });
  }
  if (!launchControls.pdfFormFillingEnabled) {
    return NextResponse.json({ error: "PDF form filling is disabled by workspace launch controls." }, { status: 409 });
  }

  const action = body.action || "generate";
  if (action === "approve") {
    if (!body.draftId) return NextResponse.json({ error: "draftId is required to approve a form draft." }, { status: 400 });
    const assessment = await assessMatterCaseSafety(body.matterId);
    if (!assessment.readyForAgentFinalReview) {
      await auditMatterAction({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        matterId: body.matterId,
        action: "form_draft.approve_blocked",
        metadata: { hardBlockers: assessment.hardBlockers.length }
      });
      return NextResponse.json({
        error: "This matter still has hard blockers. Resolve them before approving a final client-facing form copy.",
        hardBlockers: assessment.hardBlockers
      }, { status: 409 });
    }
    const draft = await approveMatterFormDraft(body.draftId, context.user.id);
    await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterOfficialFormDraft", entityId: draft.id, action: "approved" });
    return NextResponse.json({ ok: true, draft });
  }

  if (action === "publish") {
    if (!body.draftId) return NextResponse.json({ error: "draftId is required to publish a form draft." }, { status: 400 });
    const existingDraft = await prisma.matterOfficialFormDraft.findFirst({
      where: { id: body.draftId, matterId: body.matterId, workspaceId: context.workspace.id }
    });
    if (!existingDraft || existingDraft.status !== "APPROVED") {
      return NextResponse.json({ error: "Only approved form drafts can be published to the client portal." }, { status: 409 });
    }
    const assessment = await assessMatterCaseSafety(body.matterId);
    if (!assessment.readyForAgentFinalReview) {
      await auditMatterAction({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        matterId: body.matterId,
        action: "form_draft.publish_blocked",
        metadata: { hardBlockers: assessment.hardBlockers.length }
      });
      return NextResponse.json({
        error: "This matter still has hard blockers. Resolve them before publishing a client-visible form copy.",
        hardBlockers: assessment.hardBlockers
      }, { status: 409 });
    }
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
