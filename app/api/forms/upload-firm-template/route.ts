import crypto from "crypto";
import { NextResponse } from "next/server";
import { OfficialFormLifecycleStatus, OfficialFormSupportStatus } from "@prisma/client";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { detectFillableFields } from "@/lib/services/pdf-form-engine";

export async function POST(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return NextResponse.json({ error: "Only workspace owners/admins can upload firm form templates." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const title = String(formData.get("title") || "").trim();
  const formNumber = String(formData.get("formNumber") || "").trim();
  const category = String(formData.get("category") || "Firm-provided").trim();
  const subclassCodes = String(formData.get("subclassCodes") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!(file instanceof File) || !title || !formNumber) {
    return NextResponse.json({ error: "File, form title, and form number are required." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const inspection = await detectFillableFields(buffer);
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

  const template = await prisma.officialFormTemplate.create({
    data: {
      workspaceId: context.workspace.id,
      createdByUserId: context.user.id,
      sourceType: "FIRM_PROVIDED",
      formNumber,
      title,
      category,
      sourceName: context.workspace.name,
      subclassCodes,
      lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
      supportStatus: inspection.fillable ? OfficialFormSupportStatus.FILLABLE_PDF : OfficialFormSupportStatus.MANUAL_ONLY,
      isFirmProvided: true,
      downloadedAt: new Date(),
      lastCheckedAt: new Date(),
      checksum,
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      fileData: buffer,
      fieldSchemaJson: inspection.fields,
      mappingNotes: "Firm-provided template. Confirm version and field mapping before client use."
    }
  });

  return NextResponse.json({
    ok: true,
    templateId: template.id,
    fillable: inspection.fillable,
    fieldCount: inspection.fields.length
  });
}

