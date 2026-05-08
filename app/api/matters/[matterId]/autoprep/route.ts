import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { runMatterAutoprep, type AriaApprovalActionKey } from "@/lib/services/aria-autoprep";
import { auditAccessDenied } from "@/lib/services/audit";

export async function POST(req: Request, { params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication and workspace setup are required." }, { status: 401 });
  }

  if (!hasPermission(context.user, "can_edit_matters")) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Matter",
      entityId: params.matterId,
      reason: "autoprep_permission_missing"
    });
    return NextResponse.json({ error: "You do not have permission to run Aria autoprep for this matter." }, { status: 403 });
  }

  const matter = await prisma.matter.findFirst({
    where: { id: params.matterId, workspaceId: context.workspace.id },
    include: { assignedToUser: true }
  });
  if (!matter || !canAccessMatter(context.user, matter)) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Matter",
      entityId: params.matterId,
      reason: "autoprep_scope_denied"
    });
    return NextResponse.json({ error: "You do not have access to this matter." }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { approvedActions?: AriaApprovalActionKey[] } | null;
  const result = await runMatterAutoprep({
    matterId: params.matterId,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    approvedActions: body?.approvedActions ?? [],
    requestOrigin: new URL(req.url).origin
  });

  return NextResponse.json({ ok: true, result });
}
