import { NextResponse } from "next/server";
import { runOfficialUpdateIngestion } from "@/lib/services/update-ingestion";

export async function POST() {
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
