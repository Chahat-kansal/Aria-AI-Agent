import type { NextAuthOptions } from "next-auth";
import { compare } from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

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
        if (!credentials?.email || !credentials?.password) return null;

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

        if (!user?.hashedPassword || user.status !== "ACTIVE") return null;
        if (credentials.workspaceSlug && user.workspace.slug !== credentials.workspaceSlug) return null;

        const isValidPassword = await compare(credentials.password, user.hashedPassword);
        if (!isValidPassword) return null;

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
