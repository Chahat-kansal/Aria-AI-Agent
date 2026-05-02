import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { prisma } from "@/lib/prisma";
import { auditAccessDenied, auditEvent } from "@/lib/services/audit";
import { markUpdateReviewed } from "@/lib/services/migration-intel";
import { hasPermission } from "@/lib/services/roles";

export async function PATCH(_: Request, { params }: { params: { updateId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const canReview =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_review_update_impacts");

  if (!canReview) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "OfficialUpdate",
      entityId: params.updateId,
      reason: "Update review denied by permission."
    });
    return NextResponse.json({ error: "You do not have permission to review migration update impacts." }, { status: 403 });
  }

  const item = await prisma.officialUpdate.findFirst({
    where: {
      id: params.updateId,
      isArchived: false,
      OR: [{ workspaceId: null }, { workspaceId: context.workspace.id }]
    },
    select: { id: true }
  });

  if (!item) {
    return NextResponse.json({ error: "That migration intelligence item is no longer available." }, { status: 404 });
  }

  const updated = await markUpdateReviewed(params.updateId, context.user.id, context.workspace.id);

  await auditEvent({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    entityType: "OfficialUpdate",
    entityId: params.updateId,
    action: "migration_intel.reviewed"
  });

  return NextResponse.json({ ok: true, item: updated });
}
