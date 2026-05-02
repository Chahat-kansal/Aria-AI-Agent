import type { NextAuthOptions } from "next-auth";
import { compare } from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { getAuthConfigStatus, serverLog } from "@/lib/services/runtime-config";

const authConfig = getAuthConfigStatus();
if (!authConfig.configured) {
  serverLog("auth.misconfigured", { missing: authConfig.missing });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        workspaceSlug: { label: "Workspace", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          serverLog("auth.credentials_missing");
          throw new Error("MISSING_CREDENTIALS");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          select: {
            id: true,
            name: true,
            email: true,
            hashedPassword: true,
            role: true,
            workspaceId: true,
            status: true,
            visibilityScope: true,
            workspace: { select: { slug: true } }
          }
        });

        if (!user) {
          serverLog("auth.login_rejected", { email: credentials.email.toLowerCase(), reason: "user_not_found" });
          throw new Error("INVALID_CREDENTIALS");
        }

        if (user.status === UserStatus.INVITED) {
          await auditEvent({
            workspaceId: user.workspaceId,
            userId: user.id,
            entityType: "User",
            entityId: user.id,
            action: "auth.login_failed",
            metadata: { reason: "invite_not_accepted", requestedWorkspace: credentials.workspaceSlug ?? null }
          });
          serverLog("auth.login_rejected", { email: user.email, reason: "invite_not_accepted" });
          throw new Error(`INVITE_NOT_ACCEPTED:${user.workspace.slug}`);
        }

        if (user.status === UserStatus.DISABLED) {
          await auditEvent({
            workspaceId: user.workspaceId,
            userId: user.id,
            entityType: "User",
            entityId: user.id,
            action: "auth.login_failed",
            metadata: { reason: "user_deactivated", requestedWorkspace: credentials.workspaceSlug ?? null }
          });
          serverLog("auth.login_rejected", { email: user.email, reason: "user_deactivated" });
          throw new Error("USER_DEACTIVATED");
        }

        if (!user.hashedPassword) {
          serverLog("auth.login_rejected", { email: user.email, reason: "missing_password" });
          throw new Error(`PASSWORD_NOT_SET:${user.workspace.slug}`);
        }

        const publicPortalRoles = new Set<UserRole>([
          UserRole.COMPANY_OWNER,
          UserRole.COMPANY_ADMIN,
          UserRole.ORGANISATION_ACCESS_ADMIN
        ]);

        if (!credentials.workspaceSlug && !publicPortalRoles.has(user.role)) {
          await auditEvent({
            workspaceId: user.workspaceId,
            userId: user.id,
            entityType: "Workspace",
            entityId: user.workspaceId,
            action: "auth.public_portal_denied",
            metadata: { role: user.role, workspaceSlug: user.workspace.slug }
          });
          serverLog("auth.public_portal_rejected", { email: user.email, workspaceSlug: user.workspace.slug, role: user.role });
          throw new Error(`WORKSPACE_PORTAL_REQUIRED:${user.workspace.slug}`);
        }

        if (credentials.workspaceSlug && user.workspace.slug !== credentials.workspaceSlug) {
          await auditEvent({
            workspaceId: user.workspaceId,
            userId: user.id,
            entityType: "Workspace",
            entityId: user.workspaceId,
            action: "auth.workspace_login_failed",
            metadata: { requestedWorkspace: credentials.workspaceSlug, actualWorkspace: user.workspace.slug }
          });
          serverLog("auth.workspace_mismatch", { email: user.email, requestedWorkspace: credentials.workspaceSlug });
          throw new Error(`WRONG_WORKSPACE:${user.workspace.slug}`);
        }

        const isValidPassword = await compare(credentials.password, user.hashedPassword);
        if (!isValidPassword) {
          await auditEvent({
            workspaceId: user.workspaceId,
            userId: user.id,
            entityType: "User",
            entityId: user.id,
            action: "auth.login_failed",
            metadata: { reason: "bad_password", requestedWorkspace: credentials.workspaceSlug ?? null }
          });
          serverLog("auth.bad_password", { email: user.email });
          throw new Error("INVALID_CREDENTIALS");
        }

        await auditEvent({
          workspaceId: user.workspaceId,
          userId: user.id,
          entityType: "User",
          entityId: user.id,
          action: credentials.workspaceSlug ? "auth.workspace_login_succeeded" : "auth.login_succeeded",
          metadata: { workspaceSlug: user.workspace.slug }
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
          status: user.status,
          visibilityScope: user.visibilityScope
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as typeof user & { role?: string }).role;
        token.workspaceId = (user as typeof user & { workspaceId?: string }).workspaceId;
        token.status = (user as typeof user & { status?: string }).status;
        token.visibilityScope = (user as typeof user & { visibilityScope?: string }).visibilityScope;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as string | undefined;
        session.user.workspaceId = token.workspaceId as string | undefined;
        session.user.status = token.status as string | undefined;
        session.user.visibilityScope = token.visibilityScope as string | undefined;
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/sign-in"
  }
};
