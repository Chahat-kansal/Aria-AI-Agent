import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { sweepMigrationIntel } from "@/lib/services/migration-intel";

export async function POST() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const canIngest =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_access_update_monitor");
  if (!canIngest) return NextResponse.json({ error: "You do not have permission to run official update ingestion." }, { status: 403 });
  try {
    const result = await sweepMigrationIntel(context.workspace.id);
    return NextResponse.json({ status: "ok", reviewRequired: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run migration intelligence sweep.";
    const status = /not configured/i.test(message) ? 400 : 500;
    return NextResponse.json({ status: "failed", error: message }, { status });
  }
}
