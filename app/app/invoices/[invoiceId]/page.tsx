import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { InvoiceActions } from "@/components/app/invoice-actions";
import { InvoiceBuilder } from "@/components/app/invoice-builder";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageInvoiceFeature, canSendInvoiceFeature, canViewInvoiceFeature, getInvoiceByIdForUser, getInvoiceWorkspaceReferences } from "@/lib/services/invoices";
import { formatCurrency } from "@/lib/invoice-calculations";
import { getBaseUrl } from "@/lib/services/runtime-config";

export default async function InvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!canViewInvoiceFeature(context.user)) notFound();

  const [invoice, references] = await Promise.all([
    getInvoiceByIdForUser(context.workspace.id, params.invoiceId, context.user),
    getInvoiceWorkspaceReferences(context.workspace.id, context.user)
  ]);
  if (!invoice) notFound();

  return (
    <AppShell title="Invoices">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Billing"
          title={invoice.invoiceNumber}
          description={`Invoice for ${invoice.clientName}. Review required before sending or marking as paid.`}
          action={
            <InvoiceActions
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
              clientName={invoice.clientName}
              amountLabel={formatCurrency(invoice.totalCents, invoice.currency)}
              invoiceUrl={`${getBaseUrl()}/app/invoices/${invoice.id}`}
              canSend={canSendInvoiceFeature(context.user)}
              canManage={canManageInvoiceFeature(context.user)}
            />
          }
        />
        <InvoiceBuilder
          mode="edit"
          clients={references.clients}
          matters={references.matters}
          services={references.services}
          branding={references.branding}
          templates={references.templates.map((template: { id: string; name: string }) => ({ id: template.id, name: template.name }))}
          invoice={{
            id: invoice.id,
            clientId: invoice.clientId,
            matterId: invoice.matterId,
            templateId: invoice.templateId,
            brandingId: invoice.brandingId,
            clientName: invoice.clientName,
            clientEmail: invoice.clientEmail,
            clientAddress: invoice.clientAddress,
            invoiceNumber: invoice.invoiceNumber,
            issueDate: invoice.issueDate.toISOString(),
            dueDate: invoice.dueDate.toISOString(),
            currency: invoice.currency,
            discountCents: invoice.discountCents,
            lineItemsJson: invoice.lineItemsJson,
            notes: invoice.notes,
            paymentInstructions: invoice.paymentInstructions,
            generatedContent: invoice.generatedContent,
            status: invoice.status
          }}
        />
      </div>
    </AppShell>
  );
}
