import { MigrationIntelSeverity } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { auditAccessDenied, auditEvent } from "@/lib/services/audit";
import { logManualMigrationIntel } from "@/lib/services/migration-intel";
import { hasPermission } from "@/lib/services/roles";

function parseSeverity(value: unknown) {
  if (typeof value !== "string") return MigrationIntelSeverity.INFO;
  return Object.values(MigrationIntelSeverity).includes(value as MigrationIntelSeverity)
    ? (value as MigrationIntelSeverity)
    : MigrationIntelSeverity.INFO;
}

export async function POST(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  const canLogUpdate =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_log_updates");

  if (!canLogUpdate) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "OfficialUpdate",
      reason: "Manual update logging denied by permission."
    });
    return NextResponse.json({ error: "You do not have permission to log migration updates." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const sourceName = typeof body.sourceName === "string" ? body.sourceName.trim() : "Workspace note";

  if (!title || !summary) {
    return NextResponse.json({ error: "A real title and summary are required." }, { status: 400 });
  }

  const intelItem = await logManualMigrationIntel({
    workspaceId: context.workspace.id,
    title,
    summary,
    severity: parseSeverity(body.severity),
    sourceName,
    sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : null,
    affectedSubclasses: Array.isArray(body.affectedSubclasses) ? body.affectedSubclasses.map(String) : [],
    tags: Array.isArray(body.tags) ? body.tags.map(String) : []
  });

  await auditEvent({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    entityType: "OfficialUpdate",
    entityId: intelItem.id,
    action: "migration_intel.logged",
    metadata: {
      sourceType: "FIRM_NOTE",
      severity: intelItem.severity
    }
  });

  return NextResponse.json({ ok: true, item: intelItem }, { status: 201 });
}
