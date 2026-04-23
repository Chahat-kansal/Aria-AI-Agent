import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole, UserStatus, UserVisibilityScope } from "@prisma/client";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam, serializePermissions } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  visibilityScope: z.nativeEnum(UserVisibilityScope).optional(),
  permissions: z.record(z.boolean()).optional(),
  jobTitle: z.string().trim().optional().nullable(),
  supervisorId: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable()
});

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) return NextResponse.json({ error: "You do not have permission to manage team access." }, { status: 403 });

  const target = await prisma.user.findFirst({ where: { id: params.userId, workspaceId: context.workspace.id } });
  if (!target) return NextResponse.json({ error: "Team member not found." }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Valid team member updates are required." }, { status: 400 });
  if (target.role === UserRole.COMPANY_OWNER && target.id === context.user.id && parsed.data.status === UserStatus.DISABLED) {
    return NextResponse.json({ error: "Company Owner cannot deactivate their own account." }, { status: 400 });
  }

  const nextRole = parsed.data.role ?? target.role;
  const permissionsJson = parsed.data.permissions ? serializePermissions(parsed.data.permissions, nextRole) : undefined;
  const { permissions, ...updates } = parsed.data;

  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...updates,
      permissionsJson,
      deactivatedAt: parsed.data.status === UserStatus.DISABLED ? new Date() : parsed.data.status === UserStatus.ACTIVE ? null : undefined
    },
    select: { id: true, name: true, email: true, role: true, status: true, visibilityScope: true, jobTitle: true, permissionsJson: true }
  });

  return NextResponse.json({ user });
}
