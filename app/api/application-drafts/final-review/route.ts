import { NextResponse } from "next/server";
import { mapDocumentsToDraft } from "@/lib/services/application-draft";
import { assessMatterCaseSafety } from "@/lib/services/case-safety";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { serverLog } from "@/lib/services/runtime-config";
import { auditAccessDenied, auditMatterAction } from "@/lib/services/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const matterId = typeof body?.matterId === "string" ? body.matterId : null;
    if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });
    const context = await getCurrentWorkspaceContext();
    if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
    if (!hasPermission(context.user, "can_run_cross_check")) {
      await auditAccessDenied({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterApplicationDraft", entityId: matterId, reason: "cross_check_permission_missing" });
      return NextResponse.json({ error: "You do not have permission to run final cross-checks." }, { status: 403 });
    }
    const matter = await prisma.matter.findFirst({ where: { id: matterId, workspaceId: context.workspace.id }, include: { assignedToUser: true } });
    if (!matter || !canAccessMatter(context.user, matter)) {
      await auditAccessDenied({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "MatterApplicationDraft", entityId: matterId, reason: "cross_check_scope_denied" });
      return NextResponse.json({ error: "You do not have access to this matter." }, { status: 403 });
    }

    const result = await mapDocumentsToDraft(matterId);
    const assessment = await assessMatterCaseSafety(matterId);
    const openIssues = result.openIssues ?? [];
    const draftFields = result.draft.fields ?? [];
    const needsReviewFields = draftFields.filter((field: any) => field.status !== "VERIFIED").length;
    const conflictingFields = draftFields.filter((field: any) => field.status === "CONFLICTING").length;
    const missingIssues = openIssues.filter((issue: any) => String(issue.type).toLowerCase().includes("missing")).length;

    await auditMatterAction({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      matterId,
      action: "draft.final_cross_check.run",
      metadata: {
        hardBlockers: assessment.hardBlockers.length,
        softBlockers: assessment.softBlockers.length,
        readinessScore: assessment.readinessScore
      }
    });

    return NextResponse.json({
      reviewRequired: true,
      readinessScore: result.draft.readinessScore,
      openIssues: openIssues.length,
      needsReviewFields,
      conflictingFields,
      missingIssues,
      hardBlockers: assessment.hardBlockers,
      softBlockers: assessment.softBlockers,
      readyForAgentFinalReview: assessment.readyForAgentFinalReview,
      summary: assessment.readyForAgentFinalReview
        ? `Cross-check found no hard blockers at ${result.draft.readinessScore}%. This matter is ready for agent final review, but client confirmation and migration agent approval are still required.`
        : `Cross-check found ${assessment.hardBlockers.length} hard blocker(s), ${assessment.softBlockers.length} softer review item(s), ${missingIssues} missing-data/evidence check(s), ${conflictingFields} conflict(s), and ${needsReviewFields} field(s) still requiring agent review.`
    });
  } catch (error) {
    serverLog("draft.final_review_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Final cross-check failed. Please retry after reviewing matter data and uploaded documents." }, { status: 500 });
  }
}
