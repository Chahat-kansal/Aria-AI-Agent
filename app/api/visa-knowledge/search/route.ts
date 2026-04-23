import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { getVisaKnowledgeRecords } from "@/lib/services/visa-knowledge";

export async function GET(req: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
  if (!hasPermission(context.user, "can_access_visa_knowledge")) return NextResponse.json({ error: "You do not have permission to search visa knowledge." }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ results: [] });

  const records = await getVisaKnowledgeRecords(q);
  return NextResponse.json({
    results: records.slice(0, 6).map((record) => ({
      id: record.id,
      title: record.title,
      subclassCode: record.subclassCode,
      stream: record.stream,
      summary: record.summary,
      sourceType: record.sourceType,
      lastRefreshedAt: record.lastRefreshedAt
    }))
  });
}
