import { MatterStage, MatterStatus, UserRole, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureSubclass500Template } from "@/lib/services/subclass-templates";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "workspace";
}

export async function ensureWorkspaceForUser(input: { userId: string; name: string; email: string }) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, include: { workspace: true } });
  if (user?.workspace) return user.workspace;

  const workspaceName = `${input.name}'s practice`;
  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      slug: `${slugify(workspaceName)}-${Date.now().toString(36)}`,
      plan: WorkspacePlan.STARTER
    }
  });

  if (user) {
    await prisma.user.update({ where: { id: input.userId }, data: { workspaceId: workspace.id } });
  } else {
    await prisma.user.create({
      data: {
        id: input.userId,
        name: input.name,
        email: input.email,
        role: UserRole.ADMIN,
        workspaceId: workspace.id
      }
    });
  }

  return workspace;
}

export async function createMatter(input: {
  workspaceId: string;
  assignedToUserId: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone?: string;
  clientDob?: Date;
  nationality?: string;
  title: string;
  visaSubclass: string;
  visaStream: string;
  lodgementTargetDate?: Date;
}) {
  const suffix = Date.now().toString(36).toUpperCase();
  const clientReference = `CL-${suffix}`;
  const matterReference = `MAT-${input.visaSubclass}-${suffix}`;

  const client = await prisma.client.create({
    data: {
      clientReference,
      workspaceId: input.workspaceId,
      firstName: input.clientFirstName,
      lastName: input.clientLastName,
      email: input.clientEmail,
      phone: input.clientPhone || "",
      dob: input.clientDob || new Date("1990-01-01T00:00:00.000Z"),
      nationality: input.nationality || "",
      notes: "Created from matter intake"
    }
  });

  const matter = await prisma.matter.create({
    data: {
      workspaceId: input.workspaceId,
      matterReference,
      clientId: client.id,
      title: input.title,
      visaSubclass: input.visaSubclass,
      visaStream: input.visaStream,
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.INTAKE,
      assignedToUserId: input.assignedToUserId,
      readinessScore: 0,
      lodgementTargetDate: input.lodgementTargetDate
    }
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.assignedToUserId,
      entityType: "Matter",
      entityId: matter.id,
      action: "created",
      metadataJson: { source: "matter_intake", visaSubclass: input.visaSubclass }
    }
  });

  if (input.visaSubclass === "500") {
    await ensureSubclass500Template(input.workspaceId);
  }

  return matter;
}
