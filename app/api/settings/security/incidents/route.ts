import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { auditSecurityIncident } from "@/lib/services/audit";
import { redactSensitive } from "@/lib/security/encryption";

const schema = z.object({
  title: z.string().trim().min(3),
  category: z.string().trim().min(3),
  severity: z.string().trim().min(3),
  affectedEntityType: z.string().trim().optional(),
  affectedEntityId: z.string().trim().optional(),
  containmentSteps: z.string().trim().optional(),
  assessmentNotes: z.string().trim().optional(),
  notificationStatus: z.string().trim().optional()
});

export async function POST(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return NextResponse.json({ error: "You do not have permission to log security incidents." }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Valid incident details are required." }, { status: 400 });

  const incident = await prisma.securityIncident.create({
    data: {
      workspaceId: context.workspace.id,
      reportedByUserId: context.user.id,
      title: parsed.data.title,
      category: parsed.data.category,
      severity: parsed.data.severity,
      affectedEntityType: parsed.data.affectedEntityType || undefined,
      affectedEntityId: parsed.data.affectedEntityId || undefined,
      containmentSteps: parsed.data.containmentSteps || undefined,
      assessmentNotes: parsed.data.assessmentNotes || undefined,
      notificationStatus: parsed.data.notificationStatus || undefined,
      metadataJson: redactSensitive({ createdVia: "security-incidents-ui" }) as any
    }
  });

  await auditSecurityIncident({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    incidentId: incident.id,
    action: "security.incident.created"
  });

  return NextResponse.json({ incident }, { status: 201 });
}
