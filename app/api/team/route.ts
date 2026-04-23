import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole, UserStatus, UserVisibilityScope } from "@prisma/client";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam, defaultVisibilityScope, serializePermissions } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

const staffSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  role: z.nativeEnum(UserRole),
  jobTitle: z.string().trim().optional(),
  status: z.nativeEnum(UserStatus).default(UserStatus.INVITED),
  visibilityScope: z.nativeEnum(UserVisibilityScope).optional(),
  permissions: z.record(z.boolean()).optional(),
  supervisorId: z.string().optional(),
  notes: z.string().trim().optional(),
  temporaryPassword: z.string().min(8).optional()
});

export async function POST(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) return NextResponse.json({ error: "You do not have permission to manage team access." }, { status: 403 });

  const parsed = staffSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Valid staff user details are required." }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "A user already exists for this email." }, { status: 409 });

  const temporaryPassword = parsed.data.temporaryPassword || `Aria-${Date.now().toString(36)}!`;
  const visibilityScope = parsed.data.visibilityScope ?? defaultVisibilityScope(parsed.data.role);
  const permissionsJson = serializePermissions(parsed.data.permissions ?? {}, parsed.data.role);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      hashedPassword: await hash(temporaryPassword, 12),
      role: parsed.data.role,
      status: parsed.data.status,
      visibilityScope,
      permissionsJson,
      jobTitle: parsed.data.jobTitle || null,
      notes: parsed.data.notes || null,
      supervisorId: parsed.data.supervisorId || null,
      invitedAt: new Date(),
      workspaceId: context.workspace.id
    },
    select: { id: true, name: true, email: true, role: true, status: true, visibilityScope: true, jobTitle: true, permissionsJson: true }
  });

  return NextResponse.json({ user, temporaryPassword }, { status: 201 });
}
