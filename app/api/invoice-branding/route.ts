import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { upsertInvoiceBranding } from "@/lib/services/invoices";
import { serverLog } from "@/lib/services/runtime-config";

const optionalText = z.string().trim().optional().transform((value) => value || null);

const schema = z.object({
  businessName: z.string().trim().min(1).max(160),
  legalName: optionalText,
  contactEmail: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null),
  contactPhone: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  state: optionalText,
  postalCode: optionalText,
  country: optionalText,
  website: z.string().trim().url().optional().or(z.literal("")).transform((value) => value || null),
  abnAcn: optionalText,
  paymentInstructions: optionalText,
  bankDetails: optionalText,
  defaultCurrency: z.string().trim().min(3).max(8).default("AUD"),
  defaultGstRateBps: z.coerce.number().int().min(0).max(10000).default(1000),
  defaultDueDays: z.coerce.number().int().min(1).max(120).default(7),
  logoAssetId: z.string().optional().or(z.literal("")).transform((value) => value || null),
  signatureAssetId: z.string().optional().or(z.literal("")).transform((value) => value || null)
});

export async function GET() {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_manage_invoice_settings") && !hasPermission(context.user, "can_view_invoices")) {
      return NextResponse.json({ error: "You do not have permission to access invoice branding." }, { status: 403 });
    }

    const branding = await prisma.invoiceBranding.findUnique({
      where: { workspaceId: context.workspace.id },
      include: { logoAsset: true, signatureAsset: true }
    });

    return NextResponse.json({ branding });
  } catch (error) {
    serverLog("invoice_branding.fetch_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to load invoice branding right now." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_manage_invoice_settings")) {
      return NextResponse.json({ error: "You do not have permission to manage invoice settings." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid invoice branding details are required." }, { status: 400 });
    }

    const branding = await upsertInvoiceBranding({
      workspaceId: context.workspace.id,
      ...parsed.data
    });

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "InvoiceBranding",
      entityId: branding.id,
      action: "invoice.branding.updated"
    });

    return NextResponse.json({ branding });
  } catch (error) {
    serverLog("invoice_branding.update_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to save invoice branding right now." }, { status: 500 });
  }
}
