import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentWorkspaceContext() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { workspace: true }
  });

  if (!user) return null;

  return { user, workspace: user.workspace };
}

export async function requireCurrentWorkspaceContext() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    throw new Error("Authenticated workspace context is required.");
  }

  return context;
}
