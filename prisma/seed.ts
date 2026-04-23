import { PrismaClient, UserRole, WorkspacePlan } from "@prisma/client";
import { hash } from "bcryptjs";
import { ensureSubclass500Template } from "../lib/services/subclass-templates";

const prisma = new PrismaClient();

async function main() {
  const workspaceName = process.env.SEED_WORKSPACE_NAME ?? "Aria Migration Workspace";
  const workspaceSlug = process.env.SEED_WORKSPACE_SLUG ?? "aria-migration";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Workspace Admin";
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const workspace = await prisma.workspace.upsert({
    where: { slug: workspaceSlug },
    update: { name: workspaceName },
    create: {
      name: workspaceName,
      slug: workspaceSlug,
      plan: WorkspacePlan.STARTER
    }
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: UserRole.ADMIN,
      workspaceId: workspace.id
    },
    create: {
      name: adminName,
      email: adminEmail,
      hashedPassword: await hash(adminPassword, 12),
      role: UserRole.ADMIN,
      workspaceId: workspace.id
    }
  });

  await ensureSubclass500Template(workspace.id);
  console.log(`Seeded minimal workspace ${workspace.slug}. No matters, documents, updates, or client records were created.`);
}

main().finally(() => prisma.$disconnect());
