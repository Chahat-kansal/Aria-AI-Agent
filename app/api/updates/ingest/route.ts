import { NextResponse } from "next/server";
import { SeededHomeAffairsConnector } from "@/lib/connectors/update-connector";
import { ingestUpdates } from "@/lib/services/update-ingestion";

export async function POST() {
  const updates = await ingestUpdates([new SeededHomeAffairsConnector()]);

  return NextResponse.json({
    fetched: updates.length,
    deduped: updates.length,
    cronReady: true,
    updates
  });
}
