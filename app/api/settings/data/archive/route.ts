import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission, scopedClientWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { archiveMatter } from "@/lib/services/client-workflows";
import { auditEvent } from "@/lib/services/audit";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  matterId: z.string().optional(),
  clientId: z.string().optional(),
  confirm: z.literal(true)
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_export_data")) {
      return NextResponse.json({ error: "You do not have permission to archive or delete records." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Confirmation is required before archive actions." }, { status: 400 });

    if (parsed.data.matterId) {
      const matter = await prisma.matter.findFirst({
        where: { id: parsed.data.matterId, workspaceId: context.workspace.id },
        include: { assignedToUser: true }
      });
      if (!matter || !canAccessMatter(context.user, matter)) return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
      const archived = await archiveMatter({ matterId: parsed.data.matterId, workspaceId: context.workspace.id, userId: context.user.id });
      return NextResponse.json({ archived });
    }

    if (parsed.data.clientId) {
      const clientRecord = await prisma.client.findFirst({
        where: { id: parsed.data.clientId, ...scopedClientWhere(context.user) },
        select: { id: true }
      });
      if (!clientRecord) return NextResponse.json({ error: "Client is not available for this user scope." }, { status: 403 });
      const client = await prisma.client.update({
        where: { id: clientRecord.id },
        data: { archivedAt: new Date() }
      }).catch(() => null);
      await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "Client", entityId: parsed.data.clientId, action: "delete_requested", metadata: { mode: "soft" } });
      return NextResponse.json({ archived: client, message: "Client soft-delete foundations recorded. Permanent deletion remains a separately confirmed action." });
    }

    return NextResponse.json({ error: "Choose a matter or client record to archive." }, { status: 400 });
  } catch (error) {
    serverLog("settings.archive_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to archive the selected record right now." }, { status: 500 });
  }
}
