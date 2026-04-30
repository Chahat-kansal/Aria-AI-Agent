import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { buildInvoiceTemplateRecord } from "@/lib/services/invoices";
import { auditEvent } from "@/lib/services/audit";
import { prisma } from "@/lib/prisma";
import { serverLog } from "@/lib/services/runtime-config";

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  notes: z.string().trim().optional().transform((value) => value || null),
  detectedFields: z.array(z.string()).optional().default([]),
  warnings: z.array(z.string()).optional().default([])
});

export async function GET() {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_view_invoices")) {
      return NextResponse.json({ error: "You do not have permission to view invoice templates." }, { status: 403 });
    }

    const templates = await prisma.invoiceTemplate.findMany({
      where: { workspaceId: context.workspace.id },
      include: { asset: true },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ templates });
  } catch (error) {
    serverLog("invoice_templates.fetch_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to load invoice templates right now." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_manage_invoice_settings")) {
      return NextResponse.json({ error: "You do not have permission to manage invoice templates." }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "multipart file upload is required" }, { status: 415 });
    }

    const formData = await req.formData();
    const name = String(formData.get("name") || "").trim();
    const notes = String(formData.get("notes") || "").trim() || null;
    const file = formData.get("file");
    if (!name) return NextResponse.json({ error: "Template name is required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Template file is required." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const template = await buildInvoiceTemplateRecord({
      workspaceId: context.workspace.id,
      createdByUserId: context.user.id,
      name,
      notes,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes
    });

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "InvoiceTemplate",
      entityId: template.id,
      action: "invoice.template.uploaded"
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    serverLog("invoice_templates.upload_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload the invoice template right now." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_manage_invoice_settings")) {
      return NextResponse.json({ error: "You do not have permission to manage invoice templates." }, { status: 403 });
    }

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid template update details are required." }, { status: 400 });
    }

    const template = await prisma.invoiceTemplate.updateMany({
      where: { id: parsed.data.id, workspaceId: context.workspace.id },
      data: {
        name: parsed.data.name,
        notes: parsed.data.notes,
        detectedFieldsJson: { detectedFields: parsed.data.detectedFields },
        extractionWarnings: { warnings: parsed.data.warnings }
      }
    });

    if (!template.count) {
      return NextResponse.json({ error: "Invoice template not found for this workspace." }, { status: 404 });
    }

    const resolved = await prisma.invoiceTemplate.findFirst({
      where: { id: parsed.data.id, workspaceId: context.workspace.id },
      include: { asset: true }
    });
    if (!resolved) {
      return NextResponse.json({ error: "Invoice template not found for this workspace." }, { status: 404 });
    }

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "InvoiceTemplate",
      entityId: resolved.id,
      action: "invoice.template.updated"
    });

    return NextResponse.json({ template: resolved });
  } catch (error) {
    serverLog("invoice_templates.update_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to update the invoice template right now." }, { status: 500 });
  }
}
