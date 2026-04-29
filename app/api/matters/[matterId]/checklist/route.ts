import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { generateChecklistForMatter } from "@/lib/services/client-workflows";
import { serverLog } from "@/lib/services/runtime-config";

export async function POST(_: Request, { params }: { params: { matterId: string } }) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_edit_matters")) {
      return NextResponse.json({ error: "You do not have permission to generate visa checklists." }, { status: 403 });
    }

    const matter = await prisma.matter.findFirst({
      where: { id: params.matterId, workspaceId: context.workspace.id },
      include: { assignedToUser: true }
    });
    if (!matter || !canAccessMatter(context.user, matter)) {
      return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
    }

    const checklist = await generateChecklistForMatter(matter.id, context.user.id);
    return NextResponse.json({ checklist });
  } catch (error) {
    serverLog("checklist.generate_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to generate the visa checklist right now." }, { status: 500 });
  }
}
