import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { syncOfficialForms } from "@/lib/services/official-forms-sync";

export async function POST() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return NextResponse.json({ error: "Only workspace owners/admins can sync official forms." }, { status: 403 });
  }

  const result = await syncOfficialForms({ workspaceId: context.workspace.id, userId: context.user.id });
  return NextResponse.json({
    ok: true,
    reviewRequired: true,
    message: "Official forms sync completed. Review source, version, and fillable status before use.",
    ...result
  });
}

