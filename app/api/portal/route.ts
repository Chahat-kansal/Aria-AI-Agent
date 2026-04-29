import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { ensureClientPortalToken } from "@/lib/services/client-workflows";
import { auditEvent } from "@/lib/services/audit";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  clientId: z.string().min(1),
  matterId: z.string().optional(),
  label: z.string().trim().min(2).default("Client portal access")
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_manage_clients")) {
      return NextResponse.json({ error: "You do not have permission to create client portal links." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Valid client portal details are required." }, { status: 400 });

    if (parsed.data.matterId) {
      const matter = await prisma.matter.findFirst({
        where: { id: parsed.data.matterId, workspaceId: context.workspace.id },
        include: { assignedToUser: true }
      });
      if (!matter || !canAccessMatter(context.user, matter)) return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
    }

    const result = await ensureClientPortalToken({
      workspaceId: context.workspace.id,
      clientId: parsed.data.clientId,
      matterId: parsed.data.matterId,
      label: parsed.data.label
    });

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "ClientPortalAccessToken",
      entityId: result.record.id,
      action: "created",
      metadata: { clientId: parsed.data.clientId, matterId: parsed.data.matterId ?? null }
    });

    return NextResponse.json({ link: result.url, record: result.record }, { status: 201 });
  } catch (error) {
    serverLog("portal_link.create_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to create the client portal link right now." }, { status: 500 });
  }
}
