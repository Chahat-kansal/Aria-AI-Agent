import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { auditAccessDenied, auditEvent } from "@/lib/services/audit";
import { sweepMigrationIntel } from "@/lib/services/migration-intel";
import { hasPermission } from "@/lib/services/roles";

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

    const result = await sweepMigrationIntel(context.workspace.id);

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
    const message = error instanceof Error ? error.message : "Unable to complete the migration intelligence sweep.";

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "MigrationIntelSweep",
      entityId: context.workspace.id,
      action: "migration_intel.sweep.failed",
      metadata: { error: message }
    });

    const status = /not configured/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
