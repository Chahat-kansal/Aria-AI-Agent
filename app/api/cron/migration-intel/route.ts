import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { sweepMigrationIntel } from "@/lib/services/migration-intel";
import { serverLog } from "@/lib/services/runtime-config";

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      users: {
        where: { role: { in: ["COMPANY_OWNER", "COMPANY_ADMIN"] }, status: "ACTIVE" },
        orderBy: { name: "asc" },
        take: 1
      }
    }
  });

  const results: Array<{
    workspaceId: string;
    status: string;
    fetched: number;
    added: number;
    skipped: number;
    stored: number;
    impactedMatters: number;
    warning?: string | null;
    error?: string;
  }> = [];

  for (const workspace of workspaces) {
    try {
      const result = await sweepMigrationIntel(workspace.id);
      const actor = workspace.users[0];

      if (actor) {
        await auditEvent({
          workspaceId: workspace.id,
          userId: actor.id,
          entityType: "MigrationIntelSweep",
          entityId: result.sweepId,
          action: "migration_intel.cron.completed",
          metadata: result as any
        });
      }

      results.push({
        workspaceId: workspace.id,
        status: "ok",
        fetched: result.fetched,
        added: result.added,
        skipped: result.skipped,
        stored: result.stored,
        impactedMatters: result.impactedMatters,
        warning: result.warning
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLog("cron.migration_intel_error", { workspaceId: workspace.id, error: message });
      results.push({
        workspaceId: workspace.id,
        status: "failed",
        fetched: 0,
        added: 0,
        skipped: 0,
        stored: 0,
        impactedMatters: 0,
        error: message
      });
    }
  }

  return NextResponse.json({ ok: true, workspaces: results });
}
