import { NextResponse } from "next/server";
import { getConfiguredOfficialUpdateConnectors } from "@/lib/connectors/update-connector";
import { ingestUpdates } from "@/lib/services/update-ingestion";

export async function POST() {
  if (process.env.OFFICIAL_UPDATE_SCHEDULER_ENABLED !== "true") {
    return NextResponse.json({
      status: "disabled",
      message: "Official update ingestion is disabled until production connectors are configured.",
      fetched: 0,
      deduped: 0
    });
  }

  const connectors = getConfiguredOfficialUpdateConnectors();

  if (!connectors.length) {
    return NextResponse.json({
      status: "not_configured",
      message: "No official update connectors are configured.",
      fetched: 0,
      deduped: 0
    });
  }

  const updates = await ingestUpdates(connectors);

  return NextResponse.json({
    status: "ok",
    fetched: updates.length,
    deduped: updates.length,
    updates
  });
}
