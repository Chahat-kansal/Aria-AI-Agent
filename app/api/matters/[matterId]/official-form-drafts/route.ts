import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { auditAccessDenied, auditMatterAction } from "@/lib/services/audit";
import { getWorkspaceLaunchControls, isSubclassAllowedByLaunchControls } from "@/lib/services/launch-controls";
import { prepareAllMatterOfficialFormDrafts } from "@/lib/services/pdf-form-engine";

export async function POST(_: Request, { params }: { params: { matterId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_edit_matters")) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "MatterOfficialFormDraft",
      entityId: params.matterId,
      reason: "official_form_batch_permission_missing"
    });
    return NextResponse.json({ error: "You do not have permission to prepare official form drafts." }, { status: 403 });
  }

  const matter = await prisma.matter.findFirst({
    where: { id: params.matterId, workspaceId: context.workspace.id },
    include: { assignedToUser: true }
  });
  if (!matter || !canAccessMatter(context.user, matter)) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "MatterOfficialFormDraft",
      entityId: params.matterId,
      reason: "official_form_batch_scope_denied"
    });
    return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
  }

  const controls = await getWorkspaceLaunchControls(context.workspace.id);
  if (!isSubclassAllowedByLaunchControls(controls, matter.visaSubclass)) {
    return NextResponse.json({ error: `Official form drafting is disabled for Subclass ${matter.visaSubclass} by current launch controls.` }, { status: 409 });
  }
  if (!controls.pdfFormFillingEnabled) {
    return NextResponse.json({ error: "PDF form filling is disabled by workspace launch controls." }, { status: 409 });
  }

  const results = await prepareAllMatterOfficialFormDrafts({
    matterId: matter.id,
    workspaceId: context.workspace.id
  });

  await auditMatterAction({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    matterId: matter.id,
    action: "official_forms.batch_prepared",
    metadata: {
      formsPrepared: results.length,
      pdfDrafts: results.filter((item) => item.pdfGenerated).length,
      reviewPacks: results.filter((item) => item.reviewPackGenerated).length
    }
  });

  return NextResponse.json({
    ok: true,
    reviewRequired: true,
    message: "Official form drafts prepared for review. Online-only workflows receive field packs, not fake PDFs.",
    results
  });
}

