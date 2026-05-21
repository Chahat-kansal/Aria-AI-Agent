import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { auditAccessDenied, auditEvent } from "@/lib/services/audit";
import { sweepMigrationIntel } from "@/lib/services/migration-intel";
import { hasPermission } from "@/lib/services/roles";
import { toPublicErrorMessage } from "@/lib/security/public-error";

export async function POST() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const canRunSweep =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_run_update_sweep");

  if (!canRunSweep) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "MigrationIntelSweep",
      reason: "Update sweep denied by permission."
    });
    return NextResponse.json({ error: "You do not have permission to run migration intelligence sweeps." }, { status: 403 });
  }

  try {
    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "MigrationIntelSweep",
      entityId: context.workspace.id,
      action: "migration_intel.sweep.started"
    });

    const result = await Promise.race([
      sweepMigrationIntel(context.workspace.id),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Migration intelligence sweep timed out before completion.")), 25000)
      )
    ]);

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "MigrationIntelSweep",
      entityId: result.sweepId,
      action: "migration_intel.sweep.completed",
      metadata: result as any
    });

    return NextResponse.json({
      ok: true,
      reviewRequired: true,
      ...result
    });
  } catch (error) {
    const message = toPublicErrorMessage(error, "Unable to complete the migration intelligence sweep.");

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "MigrationIntelSweep",
      entityId: context.workspace.id,
      action: "migration_intel.sweep.failed",
      metadata: { error: message }
    });

    const status = /not configured|unable to fetch google news rss|timed out|network|fetch/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
