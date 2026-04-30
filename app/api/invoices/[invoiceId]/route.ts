import { NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { duplicateInvoice, getInvoiceByIdForUser } from "@/lib/services/invoices";
import { formatCurrency } from "@/lib/invoice-calculations";
import { sendInvoiceEmail } from "@/lib/services/email";
import { getBaseUrl, serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  action: z.enum(["markSent", "markPaid", "markCancelled", "duplicate"]),
  recipientEmail: z.string().trim().email().optional()
});

export async function PATCH(req: Request, { params }: { params: { invoiceId: string } }) {
  try {
    const context = await requireCurrentWorkspaceContext();
    const invoice = await getInvoiceByIdForUser(context.workspace.id, params.invoiceId, context.user);
    if (!invoice) return NextResponse.json({ error: "Invoice not found for this workspace scope." }, { status: 404 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Valid invoice action is required." }, { status: 400 });

    if (parsed.data.action === "duplicate") {
      if (!hasPermission(context.user, "can_manage_invoices")) {
        return NextResponse.json({ error: "You do not have permission to duplicate invoices." }, { status: 403 });
      }
      const duplicated = await duplicateInvoice({
        invoiceId: invoice.id,
        workspaceId: context.workspace.id,
        userId: context.user.id,
        user: context.user
      });
      await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "Invoice", entityId: duplicated.id, action: "invoice.duplicated" });
      return NextResponse.json({ invoice: duplicated }, { status: 201 });
    }

    if (parsed.data.action === "markPaid") {
      if (!hasPermission(context.user, "can_manage_invoices")) {
        return NextResponse.json({ error: "You do not have permission to update invoice status." }, { status: 403 });
      }
      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() }
      });
      await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "Invoice", entityId: invoice.id, action: "invoice.paid" });
      return NextResponse.json({ invoice: updated });
    }

    if (parsed.data.action === "markCancelled") {
      if (!hasPermission(context.user, "can_manage_invoices")) {
        return NextResponse.json({ error: "You do not have permission to update invoice status." }, { status: 403 });
      }
      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date() }
      });
      await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "Invoice", entityId: invoice.id, action: "invoice.cancelled" });
      return NextResponse.json({ invoice: updated });
    }

    if (!hasPermission(context.user, "can_send_invoices")) {
      return NextResponse.json({ error: "You do not have permission to send invoices." }, { status: 403 });
    }

    const invoiceLink = `${getBaseUrl()}/app/invoices/${invoice.id}`;
    const recipientEmail = parsed.data.recipientEmail || invoice.clientEmail || undefined;
    const emailDelivery = recipientEmail
      ? await sendInvoiceEmail({
          to: recipientEmail,
          recipientName: invoice.clientName,
          workspaceName: context.workspace.name,
          invoiceNumber: invoice.invoiceNumber,
          amountLabel: formatCurrency(invoice.totalCents, invoice.currency),
          dueDateLabel: invoice.dueDate.toLocaleDateString("en-AU"),
          invoiceLink
        })
      : { delivered: false, reason: "No client email was available. Copy and share the invoice link manually.", actionLink: invoiceLink };

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.SENT, sentAt: new Date() }
    });
    await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "Invoice", entityId: invoice.id, action: "invoice.sent" });
    return NextResponse.json({ invoice: updated, emailDelivery, link: invoiceLink });
  } catch (error) {
    serverLog("invoice.action_error", { error: error instanceof Error ? error.message : String(error), invoiceId: params.invoiceId });
    return NextResponse.json({ error: "Unable to update the invoice right now." }, { status: 500 });
  }
}
