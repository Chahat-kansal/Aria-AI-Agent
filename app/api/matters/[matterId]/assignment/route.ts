import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, canManageTeam, hasFirmWideAccess, hasTeamOversight } from "@/lib/services/roles";

const assignmentSchema = z.object({
  assignedToUserId: z.string().min(1)
});

export async function PATCH(request: Request, { params }: { params: { matterId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user) && !hasFirmWideAccess(context.user) && !hasTeamOversight(context.user)) {
    return NextResponse.json({ error: "You do not have permission to reassign matters." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = assignmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A valid assignee is required." }, { status: 400 });

  const matter = await prisma.matter.findFirst({
    where: { id: params.matterId, workspaceId: context.workspace.id },
    include: { assignedToUser: true }
  });
  if (!matter || !canAccessMatter(context.user, matter)) {
    return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
  }

  const assignee = await prisma.user.findFirst({
    where: { id: parsed.data.assignedToUserId, workspaceId: context.workspace.id, status: { not: "DISABLED" } }
  });
  if (!assignee) return NextResponse.json({ error: "Assignee was not found in this company workspace." }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const updatedMatter = await tx.matter.update({
      where: { id: matter.id },
      data: { assignedToUserId: assignee.id },
      include: { assignedToUser: true, client: true }
    });

    await tx.client.update({
      where: { id: updatedMatter.clientId },
      data: { assignedToUserId: assignee.id }
    });

    return updatedMatter;
  });

  return NextResponse.json({ matter: updated });
}
