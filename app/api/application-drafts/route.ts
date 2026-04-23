import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrGetSubclass500Draft } from "@/lib/services/application-draft";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";

export async function POST(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_edit_matters")) return NextResponse.json({ error: "You do not have permission to edit matter drafts." }, { status: 403 });
  const body = await req.json();
  if (body.subclassCode !== "500") {
    return NextResponse.json({
      error: "This subclass is available in official visa knowledge, but a field-level draft template is not configured yet.",
      templateConfigured: false,
      reviewRequired: true
    }, { status: 409 });
  }

  const matterId = typeof body.matterId === "string" ? body.matterId : null;
  if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });

  const matter = await prisma.matter.findFirst({ where: { id: matterId, workspaceId: context.workspace.id }, include: { assignedToUser: true } });
  if (!matter || !canAccessMatter(context.user, matter)) {
    return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
  }

  const draft = await createOrGetSubclass500Draft(matterId);
  return NextResponse.json({ status: "ready", reviewRequired: true, draft });
}
