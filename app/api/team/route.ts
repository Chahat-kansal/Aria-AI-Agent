import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole, UserStatus, UserVisibilityScope } from "@prisma/client";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam, defaultVisibilityScope, serializePermissions } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { buildInviteLink, createInviteToken, hashInviteToken, inviteExpiresAt } from "@/lib/services/invites";
import { sendStaffInviteEmail } from "@/lib/services/email";
import { serverLog } from "@/lib/services/runtime-config";

const staffSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  role: z.nativeEnum(UserRole),
  jobTitle: z.string().trim().optional(),
  status: z.nativeEnum(UserStatus).default(UserStatus.INVITED),
  visibilityScope: z.nativeEnum(UserVisibilityScope).optional(),
  permissions: z.record(z.boolean()).optional(),
  supervisorId: z.string().optional(),
  notes: z.string().trim().optional()
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return NextResponse.json({ error: "You do not have permission to manage team access." }, { status: 403 });

    const parsed = staffSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Valid staff user details are required." }, { status: 400 });

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, workspaceId: true, status: true } });
    if (existing?.workspaceId === context.workspace.id && existing.status === UserStatus.INVITED) {
      return NextResponse.json({ error: "This staff member already has a pending invite. Use Resend invite from the team list." }, { status: 409 });
    }
    if (existing) return NextResponse.json({ error: "A user already exists for this email." }, { status: 409 });

    const visibilityScope = parsed.data.visibilityScope ?? defaultVisibilityScope(parsed.data.role);
    const permissionsJson = serializePermissions(parsed.data.permissions ?? {}, parsed.data.role);
    const inviteToken = createInviteToken();
    const inviteLink = buildInviteLink(inviteToken);

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        hashedPassword: null,
        role: parsed.data.role,
        status: UserStatus.INVITED,
        visibilityScope,
        permissionsJson,
        jobTitle: parsed.data.jobTitle || null,
        notes: parsed.data.notes || null,
        supervisorId: parsed.data.supervisorId || null,
        invitedAt: new Date(),
        inviteTokenHash: hashInviteToken(inviteToken),
        inviteExpiresAt: inviteExpiresAt(),
        workspaceId: context.workspace.id
      },
      select: { id: true, name: true, email: true, role: true, status: true, visibilityScope: true, jobTitle: true, permissionsJson: true }
    });

    const emailDelivery = await sendStaffInviteEmail({
      to: email,
      recipientName: parsed.data.name,
      workspaceName: context.workspace.name,
      inviteLink
    });

    return NextResponse.json({ user, inviteLink, emailDelivery }, { status: 201 });
  } catch (error) {
    serverLog("team.invite_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to create staff invite right now." }, { status: 500 });
  }
}
