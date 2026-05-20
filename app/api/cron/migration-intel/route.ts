import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { sweepMigrationIntel } from "@/lib/services/migration-intel";
import { serverLog } from "@/lib/services/runtime-config";
import { getCronAuthFailure } from "@/lib/security/cron-auth";
import { enforceRateLimit, getRequestIp } from "@/lib/security/rate-limit";

export async function GET(req: Request) {
  const limited = enforceRateLimit(req, { action: "cron.migration-intel", scope: getRequestIp(req), limit: 6, windowMs: 60_000 });
  if (limited) return limited;
  const authFailure = getCronAuthFailure(req, "migration-intel");
  if (authFailure) return authFailure;

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

  const settled = await Promise.all(
    workspaces.map(async (workspace) => {
      try {
        const result = await Promise.race([
          sweepMigrationIntel(workspace.id),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Migration intelligence cron sweep timed out before completion.")), 25000)
          )
        ]);
        const actor = workspace.users[0];

        if (actor) {
          await auditEvent({
            workspaceId: workspace.id,
            userId: actor.id,
            entityType: "MigrationIntelSweep",
            entityId: result.sweepId,
            action: "migration_intel.cron.completed",
            metadata: { ...(result as any), cronAuth: "secret_verified" }
          });
        }

        return {
          workspaceId: workspace.id,
          status: "ok",
          fetched: result.fetched,
          added: result.added,
          skipped: result.skipped,
          stored: result.stored,
          impactedMatters: result.impactedMatters,
          warning: result.warning
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        serverLog("cron.migration_intel_error", { workspaceId: workspace.id, error: message });
        return {
          workspaceId: workspace.id,
          status: "failed",
          fetched: 0,
          added: 0,
          skipped: 0,
          stored: 0,
          impactedMatters: 0,
          error: message
        };
      }
    })
  );

  results.push(...settled);

  return NextResponse.json({ ok: true, workspaces: results });
}
