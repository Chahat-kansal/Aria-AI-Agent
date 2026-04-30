import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  id: z.string().optional(),
  serviceName: z.string().trim().min(1).max(160),
  description: z.string().trim().optional().transform((value) => value || null),
  defaultPriceCents: z.coerce.number().int().min(0),
  currency: z.string().trim().min(3).max(8).default("AUD"),
  gstRateBps: z.coerce.number().int().min(0).max(10000).default(1000),
  isTaxInclusive: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true)
});

export async function GET() {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_view_invoices")) {
      return NextResponse.json({ error: "You do not have permission to view invoice services." }, { status: 403 });
    }

    const services = await prisma.invoiceService.findMany({
      where: { workspaceId: context.workspace.id },
      orderBy: [{ active: "desc" }, { serviceName: "asc" }]
    });
    return NextResponse.json({ services });
  } catch (error) {
    serverLog("invoice_services.fetch_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to load invoice services right now." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_manage_invoice_settings")) {
      return NextResponse.json({ error: "You do not have permission to manage invoice services." }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid invoice service details are required." }, { status: 400 });
    }

    if (parsed.data.id) {
      const updated = await prisma.invoiceService.updateMany({
        where: { id: parsed.data.id, workspaceId: context.workspace.id },
        data: {
          serviceName: parsed.data.serviceName,
          description: parsed.data.description,
          defaultPriceCents: parsed.data.defaultPriceCents,
          currency: parsed.data.currency,
          gstRateBps: parsed.data.gstRateBps,
          isTaxInclusive: parsed.data.isTaxInclusive,
          active: parsed.data.active
        }
      });
      if (!updated.count) {
        return NextResponse.json({ error: "Invoice service not found for this workspace." }, { status: 404 });
      }
    }

    const service = parsed.data.id
      ? await prisma.invoiceService.findFirst({
          where: { id: parsed.data.id, workspaceId: context.workspace.id }
        })
      : await prisma.invoiceService.create({
          data: {
            workspaceId: context.workspace.id,
            serviceName: parsed.data.serviceName,
            description: parsed.data.description,
            defaultPriceCents: parsed.data.defaultPriceCents,
            currency: parsed.data.currency,
            gstRateBps: parsed.data.gstRateBps,
            isTaxInclusive: parsed.data.isTaxInclusive,
            active: parsed.data.active
          }
        });
    if (!service) {
      return NextResponse.json({ error: "Invoice service not found for this workspace." }, { status: 404 });
    }

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "InvoiceService",
      entityId: service.id,
      action: parsed.data.id ? "invoice.service.updated" : "invoice.service.created"
    });

    return NextResponse.json({ service }, { status: parsed.data.id ? 200 : 201 });
  } catch (error) {
    serverLog("invoice_services.save_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to save invoice service right now." }, { status: 500 });
  }
}
