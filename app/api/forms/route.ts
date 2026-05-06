import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_edit_matters")) {
    return NextResponse.json({ error: "You do not have permission to view official forms." }, { status: 403 });
  }

  const templates = await prisma.officialFormTemplate.findMany({
    where: { OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }] },
    orderBy: [{ lifecycleStatus: "asc" }, { formNumber: "asc" }]
  });

  return NextResponse.json({
    templates,
    canSync: canManageTeam(context.user),
    canUploadFirmTemplate: canManageTeam(context.user)
  });
}

