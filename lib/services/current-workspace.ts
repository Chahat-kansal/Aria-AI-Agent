import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentWorkspaceContext() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? "mia@southerncross.example";

  let user = await prisma.user.findUnique({
    where: { email },
    include: { workspace: true }
  });

  if (!user) {
    const workspace =
      (await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } })) ??
      (await prisma.workspace.create({
        data: { name: "Migration Practice", slug: "migration-practice", plan: "GROWTH" }
      }));

    user = await prisma.user.create({
      data: {
        name: session?.user?.name ?? "Migration Agent",
        email,
        role: "ADMIN",
        workspaceId: workspace.id
      },
      include: { workspace: true }
    });
  }

  return { user, workspace: user.workspace };
}
