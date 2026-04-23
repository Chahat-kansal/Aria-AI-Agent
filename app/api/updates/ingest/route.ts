import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { runOfficialUpdateIngestion } from "@/lib/services/update-ingestion";

export async function POST() {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_access_update_monitor")) return NextResponse.json({ error: "You do not have permission to run official update ingestion." }, { status: 403 });

  if (process.env.OFFICIAL_UPDATE_INGESTION_ENABLED !== "true") {
    return NextResponse.json({
      status: "disabled",
      message: "Official update ingestion is disabled until production monitoring is enabled.",
      fetched: 0,
      stored: 0,
      impactedMatters: 0
    });
  }

  const result = await runOfficialUpdateIngestion();

  return NextResponse.json({
    status: "ok",
    reviewRequired: true,
    ...result
  });
}
