import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { inspectPdfFormFields, mapPdfFieldsToAriaFields, saveManualFieldMapping } from "@/lib/services/pdf-form-engine";

export async function GET(_: Request, { params }: { params: { templateId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_edit_matters")) {
    return NextResponse.json({ error: "You do not have permission to inspect official forms." }, { status: 403 });
  }

  const template = await prisma.officialFormTemplate.findFirst({
    where: { id: params.templateId, OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }] }
  });
  if (!template) return NextResponse.json({ error: "Form template not found." }, { status: 404 });

  const inspection = await inspectPdfFormFields(template.id);
  const mapping = await mapPdfFieldsToAriaFields(template.id);
  return NextResponse.json({ template, inspection, mapping });
}

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_edit_matters")) {
    return NextResponse.json({ error: "You do not have permission to update form mappings." }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { mappings?: Record<string, string> } | null;
  if (!body?.mappings || typeof body.mappings !== "object") {
    return NextResponse.json({ error: "Mappings are required." }, { status: 400 });
  }

  const template = await prisma.officialFormTemplate.findFirst({
    where: { id: params.templateId, OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }] }
  });
  if (!template) return NextResponse.json({ error: "Form template not found." }, { status: 404 });

  const updated = await saveManualFieldMapping(template.id, body.mappings);
  return NextResponse.json({ ok: true, template: updated });
}

