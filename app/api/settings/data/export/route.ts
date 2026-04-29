import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission, scopedClientWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { exportMatterPackage } from "@/lib/services/client-workflows";
import { auditEvent } from "@/lib/services/audit";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  matterId: z.string().optional(),
  clientId: z.string().optional(),
  exportType: z.enum(["workspace", "matter", "client"]).default("workspace")
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_export_data")) {
      return NextResponse.json({ error: "You do not have permission to export data." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Valid export details are required." }, { status: 400 });

    if (parsed.data.exportType === "matter" && parsed.data.matterId) {
      const matter = await prisma.matter.findFirst({
        where: { id: parsed.data.matterId, workspaceId: context.workspace.id },
        include: { assignedToUser: true }
      });
      if (!matter || !canAccessMatter(context.user, matter)) return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });

      const payload = await exportMatterPackage(parsed.data.matterId);
      await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "Matter", entityId: parsed.data.matterId, action: "exported", metadata: { exportType: "matter" } });
      return NextResponse.json({ payload });
    }

    if (parsed.data.exportType === "client" && parsed.data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: parsed.data.clientId, ...scopedClientWhere(context.user) },
        include: { matters: { include: { documents: true, validationIssues: true, checklistItems: true } } }
      });
      if (!client) return NextResponse.json({ error: "Client is not available for this user scope." }, { status: 403 });
      await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "Client", entityId: client.id, action: "exported", metadata: { exportType: "client" } });
      return NextResponse.json({ payload: client });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: context.workspace.id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true, status: true } },
        clients: { select: { id: true, firstName: true, lastName: true, clientReference: true } },
        matters: { select: { id: true, title: true, visaSubclass: true, status: true, readinessScore: true } }
      }
    });
    await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "Workspace", entityId: context.workspace.id, action: "exported", metadata: { exportType: "workspace" } });
    return NextResponse.json({ payload: workspace });
  } catch (error) {
    serverLog("settings.export_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to export data right now." }, { status: 500 });
  }
}
