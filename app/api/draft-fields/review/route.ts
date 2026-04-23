import { DraftFieldStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateDraftFieldReview } from "@/lib/services/application-draft";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";

export async function POST(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_edit_matters")) return NextResponse.json({ error: "You do not have permission to update draft fields." }, { status: 403 });
  const body = await req.json();
  const draftFieldId = typeof body.draftFieldId === "string" ? body.draftFieldId : null;
  const status = typeof body.status === "string" ? body.status : null;

  if (!draftFieldId || !status || !(status in DraftFieldStatus)) {
    return NextResponse.json({ error: "draftFieldId and valid status are required" }, { status: 400 });
  }

  const field = await prisma.matterDraftField.findUnique({
    where: { id: draftFieldId },
    include: { draft: { include: { matter: { include: { assignedToUser: true } } } } }
  });
  if (!field || !canAccessMatter(context.user, field.draft.matter)) {
    return NextResponse.json({ error: "Draft field is not available for this user scope." }, { status: 403 });
  }

  const updatedField = await updateDraftFieldReview({
    draftFieldId,
    status: DraftFieldStatus[status as keyof typeof DraftFieldStatus],
    manualOverride: typeof body.manualOverride === "string" ? body.manualOverride : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined
  });

  return NextResponse.json({ status: "updated", field: updatedField });
}
