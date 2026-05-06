import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { syncOfficialForms } from "@/lib/services/official-forms-sync";

export async function POST(_: Request, { params }: { params: { templateId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return NextResponse.json({ error: "Only workspace owners/admins can refresh official forms." }, { status: 403 });
  }

  const template = await prisma.officialFormTemplate.findFirst({
    where: { id: params.templateId, OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }] }
  });
  if (!template) return NextResponse.json({ error: "Form template not found." }, { status: 404 });

  const result = await syncOfficialForms({ workspaceId: context.workspace.id, userId: context.user.id });
  return NextResponse.json({ ok: true, templateId: template.id, ...result });
}

