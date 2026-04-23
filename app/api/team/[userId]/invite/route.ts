import { NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail } from "@/lib/services/email";
import { buildInviteLink, createInviteToken, hashInviteToken, inviteExpiresAt } from "@/lib/services/invites";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";

export async function POST(_req: Request, { params }: { params: { userId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) return NextResponse.json({ error: "You do not have permission to manage team access." }, { status: 403 });

  const target = await prisma.user.findFirst({
    where: { id: params.userId, workspaceId: context.workspace.id },
    include: { workspace: true }
  });
  if (!target) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  if (target.status !== UserStatus.INVITED) return NextResponse.json({ error: "Only invited users can receive a fresh invite link." }, { status: 400 });

  const token = createInviteToken();
  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      inviteTokenHash: hashInviteToken(token),
      inviteExpiresAt: inviteExpiresAt(),
      invitedAt: new Date()
    },
    include: { workspace: true }
  });
  const inviteLink = buildInviteLink(token);
  const emailDelivery = await sendStaffInviteEmail({
    to: updated.email,
    recipientName: updated.name,
    workspaceName: updated.workspace.name,
    inviteLink
  });

  return NextResponse.json({ inviteLink, emailDelivery });
}
