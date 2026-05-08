import { NextResponse } from "next/server";
import { buildDraftAutofillGroundedResponse, mapDocumentsToDraft } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { aiNotConfiguredResponse, isAiConfigured } from "@/lib/services/ai-config";
import { serverLog } from "@/lib/services/runtime-config";
import { auditAiUsed, auditAccessDenied, auditMatterAction } from "@/lib/services/audit";
import { getWorkspaceLaunchControls, isSubclassAllowedByLaunchControls } from "@/lib/services/launch-controls";
import { getSubclassSupport } from "@/lib/services/subclass-support";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const matterId = typeof body.matterId === "string" ? body.matterId : null;
    if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });
    const context = await getCurrentWorkspaceContext();
    if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
    if (!hasPermission(context.user, "can_access_ai")) {
      await auditAccessDenied({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterApplicationDraft", entityId: matterId, reason: "ai_permission_missing" });
      return NextResponse.json({ error: "You do not have permission to run AI-assisted draft mapping." }, { status: 403 });
    }
    if (!isAiConfigured()) return NextResponse.json(aiNotConfiguredResponse(), { status: 503 });
    const matter = await prisma.matter.findFirst({ where: { id: matterId, workspaceId: context.workspace.id }, include: { assignedToUser: true } });
    if (!matter || !canAccessMatter(context.user, matter)) {
      await auditAccessDenied({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterApplicationDraft", entityId: matterId, reason: "matter_scope_denied" });
      return NextResponse.json({ error: "You do not have access to this matter." }, { status: 403 });
    }
    const launchControls = await getWorkspaceLaunchControls(context.workspace.id);
    if (!launchControls.aiDraftAutofillEnabled) {
      return NextResponse.json({ error: "AI draft autofill is disabled by workspace launch controls." }, { status: 409 });
    }
    if (!isSubclassAllowedByLaunchControls(launchControls, matter.visaSubclass)) {
      return NextResponse.json({ error: `AI draft autofill is disabled for Subclass ${matter.visaSubclass} by current launch controls.` }, { status: 409 });
    }
    const support = getSubclassSupport(matter.visaSubclass);
    if (!support.aiDraftAutofill) {
      return NextResponse.json({
        error: `Field-level draft autofill is not configured for Subclass ${matter.visaSubclass}.`,
        supportLevel: support.supportLevel,
        reviewRequired: true
      }, { status: 409 });
    }

    const result = await mapDocumentsToDraft(matterId);
    const grounded = await buildDraftAutofillGroundedResponse(matterId);
    await auditAiUsed({ workspaceId: context.workspace.id, userId: context.user.id, feature: "draft_autofill", matterId });
    await auditMatterAction({ workspaceId: context.workspace.id, userId: context.user.id, matterId, action: "draft.autofill.run" });
    return NextResponse.json({
      status: "mapped",
      message: grounded.answer,
      grounded,
      result
    });
  } catch (error) {
    serverLog("draft.mapping_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Draft mapping failed. Agent review is still required before any client-facing use." }, { status: 500 });
  }
}
