import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { UserStatus, type Prisma, type User } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { redactSensitive } from "@/lib/security/redaction";

function platformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(email?: string | null) {
  if (!email) return false;
  return platformAdminEmails().includes(email.toLowerCase());
}

export function isPlatformAdmin(user?: Pick<User, "email" | "status"> | null) {
  return Boolean(user && user.status !== UserStatus.DISABLED && isPlatformAdminEmail(user.email));
}

export async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email || !isPlatformAdminEmail(email)) notFound();

  const user = await prisma.user.findUnique({ where: { email }, include: { workspace: true } });
  if (!user || user.status === UserStatus.DISABLED) notFound();

  await auditPlatformAdminAction(user, "platform_admin.access", { route: "platform-admin" });
  return { user, workspace: user.workspace };
}

export async function auditPlatformAdminAction(
  user: Pick<User, "id" | "workspaceId" | "email">,
  action: string,
  metadata?: Prisma.InputJsonObject
) {
  await auditEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    entityType: "PlatformAdmin",
    entityId: user.email,
    action,
    metadata: redactSensitive(metadata ?? {}) as Prisma.InputJsonObject
  });
}

