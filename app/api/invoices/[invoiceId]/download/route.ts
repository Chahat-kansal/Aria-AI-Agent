import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { auditEvent } from "@/lib/services/audit";
import { canViewInvoiceFeature, getInvoiceByIdForUser } from "@/lib/services/invoices";
import { serverLog } from "@/lib/services/runtime-config";

export async function POST(_: Request, { params }: { params: { invoiceId: string } }) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!canViewInvoiceFeature(context.user)) {
      return NextResponse.json({ error: "You do not have permission to download invoices." }, { status: 403 });
    }

    const invoice = await getInvoiceByIdForUser(context.workspace.id, params.invoiceId, context.user);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found for this workspace scope." }, { status: 404 });
    }

    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Invoice",
      entityId: invoice.id,
      action: "invoice.downloaded"
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    serverLog("invoice.download_error", { error: error instanceof Error ? error.message : String(error), invoiceId: params.invoiceId });
    return NextResponse.json({ error: "Unable to prepare invoice download right now." }, { status: 500 });
  }
}
