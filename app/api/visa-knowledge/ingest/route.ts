import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { ingestVisaKnowledge } from "@/lib/services/visa-knowledge";

export async function POST() {
  await requireCurrentWorkspaceContext();
  const result = await ingestVisaKnowledge();
  return NextResponse.json({ ...result, reviewRequired: true });
}
