import crypto from "crypto";
import { hash } from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBaseUrl, serverLog } from "@/lib/services/runtime-config";

export function createInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function inviteExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);
  return expiresAt;
}

export function buildInviteLink(token: string) {
  const baseUrl = getBaseUrl() || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/invite/${token}`;
}

export async function getInviteByToken(token: string) {
  return prisma.user.findFirst({
    where: {
      inviteTokenHash: hashInviteToken(token),
      status: UserStatus.INVITED,
      inviteExpiresAt: { gt: new Date() }
    },
    include: { workspace: true, supervisor: true }
  });
}

export async function acceptInvite(input: { token: string; password: string }) {
  const invitedUser = await getInviteByToken(input.token);
  if (!invitedUser) {
    serverLog("invite.accept_failed", { reason: "invalid_expired_or_reused" });
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirst({
      where: {
        id: invitedUser.id,
        status: UserStatus.INVITED,
        inviteTokenHash: hashInviteToken(input.token),
        inviteExpiresAt: { gt: new Date() }
      }
    });
    if (!current) return null;

    return tx.user.update({
      where: { id: invitedUser.id },
      data: {
        hashedPassword: await hash(input.password, 12),
        status: UserStatus.ACTIVE,
        inviteAcceptedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null
      },
      include: { workspace: true }
    });
  });
}
