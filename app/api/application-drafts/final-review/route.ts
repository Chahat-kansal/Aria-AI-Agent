import { NextResponse } from "next/server";
import { mapDocumentsToDraft } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const matterId = typeof body?.matterId === "string" ? body.matterId : null;
  if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
  if (!hasPermission(context.user, "can_run_cross_check")) return NextResponse.json({ error: "You do not have permission to run final cross-checks." }, { status: 403 });
  const matter = await prisma.matter.findFirst({ where: { id: matterId, workspaceId: context.workspace.id }, include: { assignedToUser: true } });
  if (!matter || !canAccessMatter(context.user, matter)) return NextResponse.json({ error: "You do not have access to this matter." }, { status: 403 });

  const result = await mapDocumentsToDraft(matterId);
  const openIssues = result.openIssues ?? [];
  const draftFields = result.draft.fields ?? [];
  const needsReviewFields = draftFields.filter((field: any) => field.status !== "VERIFIED").length;
  const conflictingFields = draftFields.filter((field: any) => field.status === "CONFLICTING").length;
  const missingIssues = openIssues.filter((issue: any) => String(issue.type).toLowerCase().includes("missing")).length;
  const readyForClientReview = openIssues.length === 0 && needsReviewFields === 0;

  return NextResponse.json({
    reviewRequired: true,
    readinessScore: result.draft.readinessScore,
    openIssues: openIssues.length,
    needsReviewFields,
    conflictingFields,
    missingIssues,
    readyForClientReview,
    summary: readyForClientReview
      ? `Submission-readiness cross-check found no open validation issues at ${result.draft.readinessScore}%. Migration agent final review and client confirmation are still required.`
      : `Submission-readiness cross-check found ${openIssues.length} open issue(s), ${missingIssues} missing-data/evidence check(s), ${conflictingFields} conflict(s), and ${needsReviewFields} field(s) still requiring agent review.`
  });
}
