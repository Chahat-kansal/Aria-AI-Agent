import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageInvoiceFeature } from "@/lib/services/invoices";
import { createInvoicePaymentLink } from "@/lib/services/payments/invoice-payments";
import { auditAccessDenied } from "@/lib/services/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { serverLog } from "@/lib/services/runtime-config";

export async function POST(req: Request, { params }: { params: { invoiceId: string } }) {
  try {
    const limit = enforceRateLimit(req, {
      action: "invoice.payment_link",
      limit: 5,
      windowMs: 60_000
    });
    if (limit) return limit;

    const context = await requireCurrentWorkspaceContext();
    if (!canManageInvoiceFeature(context.user)) {
      await auditAccessDenied({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        entityType: "Invoice",
        entityId: params.invoiceId,
        reason: "invoice_payment_link_requires_invoice_management_permission"
      });
      return NextResponse.json({ error: "You do not have permission to create invoice payment links." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }

    const result = await createInvoicePaymentLink({
      workspaceId: context.workspace.id,
      invoiceId: params.invoiceId,
      user: context.user
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    serverLog("invoice.payment_link_route_error", { invoiceId: params.invoiceId, reason: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to create an invoice payment link right now." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
