import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { ingestVisaKnowledge } from "@/lib/services/visa-knowledge";

export async function POST() {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_access_visa_knowledge")) return NextResponse.json({ error: "You do not have permission to refresh visa knowledge." }, { status: 403 });
  const result = await ingestVisaKnowledge();
  return NextResponse.json({ ...result, reviewRequired: true });
}
