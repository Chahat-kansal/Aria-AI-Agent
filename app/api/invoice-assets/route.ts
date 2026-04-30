import { NextResponse } from "next/server";
import { InvoiceAssetKind } from "@prisma/client";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { createInvoiceAsset, upsertInvoiceBranding } from "@/lib/services/invoices";
import { auditEvent } from "@/lib/services/audit";
import { prisma } from "@/lib/prisma";
import { serverLog } from "@/lib/services/runtime-config";

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_manage_invoice_settings")) {
      return NextResponse.json({ error: "You do not have permission to manage invoice assets." }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "multipart file upload is required" }, { status: 415 });
    }

    const formData = await req.formData();
    const usage = String(formData.get("usage") || "");
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const fileName = file.name || "asset";
    const kind = usage === "signature" ? InvoiceAssetKind.SIGNATURE : InvoiceAssetKind.LOGO;

    const asset = await createInvoiceAsset({
      workspaceId: context.workspace.id,
      kind,
      fileName,
      mimeType,
      bytes
    });

    const existingBranding = await prisma.invoiceBranding.findUnique({
      where: { workspaceId: context.workspace.id }
    });

    const current = usage === "signature"
      ? await upsertInvoiceBranding({
          workspaceId: context.workspace.id,
          businessName: existingBranding?.businessName || context.workspace.name,
          legalName: existingBranding?.legalName,
          contactEmail: existingBranding?.contactEmail,
          contactPhone: existingBranding?.contactPhone,
          addressLine1: existingBranding?.addressLine1,
          addressLine2: existingBranding?.addressLine2,
          city: existingBranding?.city,
          state: existingBranding?.state,
          postalCode: existingBranding?.postalCode,
          country: existingBranding?.country,
          website: existingBranding?.website,
          abnAcn: existingBranding?.abnAcn,
          paymentInstructions: existingBranding?.paymentInstructions,
          bankDetails: existingBranding?.bankDetails,
          defaultCurrency: existingBranding?.defaultCurrency || "AUD",
          defaultGstRateBps: existingBranding?.defaultGstRateBps ?? 1000,
          defaultDueDays: existingBranding?.defaultDueDays ?? 7,
          logoAssetId: existingBranding?.logoAssetId,
          signatureAssetId: asset.id
        })
      : await upsertInvoiceBranding({
          workspaceId: context.workspace.id,
          businessName: existingBranding?.businessName || context.workspace.name,
          legalName: existingBranding?.legalName,
          contactEmail: existingBranding?.contactEmail,
          contactPhone: existingBranding?.contactPhone,
          addressLine1: existingBranding?.addressLine1,
          addressLine2: existingBranding?.addressLine2,
          city: existingBranding?.city,
          state: existingBranding?.state,
          postalCode: existingBranding?.postalCode,
          country: existingBranding?.country,
          website: existingBranding?.website,
          abnAcn: existingBranding?.abnAcn,
          paymentInstructions: existingBranding?.paymentInstructions,
          bankDetails: existingBranding?.bankDetails,
          defaultCurrency: existingBranding?.defaultCurrency || "AUD",
          defaultGstRateBps: existingBranding?.defaultGstRateBps ?? 1000,
          defaultDueDays: existingBranding?.defaultDueDays ?? 7,
          logoAssetId: asset.id,
          signatureAssetId: existingBranding?.signatureAssetId
        });

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "InvoiceAsset",
      entityId: asset.id,
      action: usage === "signature" ? "invoice.signature.uploaded" : "invoice.logo.uploaded"
    });

    return NextResponse.json({ asset, branding: current }, { status: 201 });
  } catch (error) {
    serverLog("invoice_assets.upload_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload invoice asset right now." }, { status: 500 });
  }
}
