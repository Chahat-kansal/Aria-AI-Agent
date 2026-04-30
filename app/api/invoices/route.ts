import { NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { nextInvoiceNumber, saveInvoice, scopedInvoiceWhere } from "@/lib/services/invoices";
import { serverLog } from "@/lib/services/runtime-config";

const lineItemSchema = z.object({
  id: z.string().optional(),
  serviceId: z.string().optional().nullable(),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().min(0),
  unitPriceCents: z.coerce.number().int().min(0),
  gstRateBps: z.coerce.number().int().min(0).max(10000),
  isTaxInclusive: z.coerce.boolean().default(false)
});

const invoiceSchema = z.object({
  invoiceId: z.string().optional(),
  clientId: z.string().optional().nullable(),
  matterId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  brandingId: z.string().optional().nullable(),
  clientName: z.string().trim().min(1),
  clientEmail: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null),
  clientAddress: z.string().trim().optional().transform((value) => value || null),
  invoiceNumber: z.string().trim().min(1),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  currency: z.string().trim().min(3).max(8),
  discountCents: z.coerce.number().int().min(0).default(0),
  lineItems: z.array(lineItemSchema).min(1),
  notes: z.string().trim().optional().transform((value) => value || null),
  paymentInstructions: z.string().trim().optional().transform((value) => value || null),
  generatedContent: z.string().trim().optional().transform((value) => value || null),
  aiReasoningJson: z.any().optional(),
  reviewRequired: z.coerce.boolean().default(true),
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.DRAFT)
});

export async function GET(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_view_invoices")) {
      return NextResponse.json({ error: "You do not have permission to view invoices." }, { status: 403 });
    }
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q");

    const invoices = await prisma.invoice.findMany({
      where: {
        ...scopedInvoiceWhere(context.user),
        ...(status ? { status: status as InvoiceStatus } : {}),
        ...(q ? { OR: [{ invoiceNumber: { contains: q, mode: "insensitive" } }, { clientName: { contains: q, mode: "insensitive" } }] } : {})
      },
      include: {
        client: true,
        matter: { include: { client: true } },
        createdByUser: true
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }]
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    serverLog("invoices.fetch_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to load invoices right now." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_manage_invoices")) {
      return NextResponse.json({ error: "You do not have permission to manage invoices." }, { status: 403 });
    }
    const parsed = invoiceSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid invoice details are required." }, { status: 400 });
    }

    const invoiceNumber = parsed.data.invoiceNumber === "AUTO"
      ? await nextInvoiceNumber(context.workspace.id)
      : parsed.data.invoiceNumber;

    const invoice = await saveInvoice({
      workspaceId: context.workspace.id,
      user: context.user,
      userId: context.user.id,
      invoiceId: parsed.data.invoiceId,
      clientId: parsed.data.clientId,
      matterId: parsed.data.matterId,
      templateId: parsed.data.templateId,
      brandingId: parsed.data.brandingId,
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail,
      clientAddress: parsed.data.clientAddress,
      invoiceNumber,
      issueDate: parsed.data.issueDate,
      dueDate: parsed.data.dueDate,
      currency: parsed.data.currency,
      lineItems: parsed.data.lineItems,
      discountCents: parsed.data.discountCents,
      notes: parsed.data.notes,
      paymentInstructions: parsed.data.paymentInstructions,
      generatedContent: parsed.data.generatedContent,
      aiReasoningJson: parsed.data.aiReasoningJson,
      reviewRequired: parsed.data.reviewRequired,
      status: parsed.data.status
    });

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Invoice",
      entityId: invoice.id,
      action: parsed.data.invoiceId ? "invoice.updated" : "invoice.created"
    });

    return NextResponse.json({ invoice }, { status: parsed.data.invoiceId ? 200 : 201 });
  } catch (error) {
    serverLog("invoices.save_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to save the invoice right now." }, { status: 500 });
  }
}
