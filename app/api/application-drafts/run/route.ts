import { NextResponse } from "next/server";
import { mapDocumentsToDraft } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { aiNotConfiguredResponse, isAiConfigured } from "@/lib/services/ai-config";

export async function POST(req: Request) {
  const body = await req.json();
  const matterId = typeof body.matterId === "string" ? body.matterId : null;
  if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
  if (!hasPermission(context.user, "can_access_ai")) return NextResponse.json({ error: "You do not have permission to run AI-assisted draft mapping." }, { status: 403 });
  if (!isAiConfigured()) return NextResponse.json(aiNotConfiguredResponse(), { status: 503 });
  const matter = await prisma.matter.findFirst({ where: { id: matterId, workspaceId: context.workspace.id }, include: { assignedToUser: true } });
  if (!matter || !canAccessMatter(context.user, matter)) return NextResponse.json({ error: "You do not have access to this matter." }, { status: 403 });

  const result = await mapDocumentsToDraft(matterId);
  return NextResponse.json({
    status: "mapped",
    message: "AI-assisted extraction and mapping completed. Agent review required.",
    result
  });
}
