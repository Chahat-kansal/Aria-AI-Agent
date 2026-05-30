import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { InvoiceActions } from "@/components/app/invoice-actions";
import { InvoiceBuilder } from "@/components/app/invoice-builder";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { revalidatePath } from "next/cache";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageInvoiceFeature, canSendInvoiceFeature, canViewInvoiceFeature, getInvoiceByIdForUser, getInvoiceWorkspaceReferences } from "@/lib/services/invoices";
import { formatCurrency } from "@/lib/invoice-calculations";
import { getBaseUrl } from "@/lib/services/runtime-config";
import { getInvoiceAccountingSyncView } from "@/lib/services/accounting-integration";
import { createInvoicePaymentLink, getLatestInvoicePaymentLink } from "@/lib/services/payments/invoice-payments";
import { getPaymentProviderStatus } from "@/lib/providers/payment-provider";

export default async function InvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!canViewInvoiceFeature(context.user)) notFound();

  const [invoice, references] = await Promise.all([
    getInvoiceByIdForUser(context.workspace.id, params.invoiceId, context.user),
    getInvoiceWorkspaceReferences(context.workspace.id, context.user)
  ]);
  if (!invoice) notFound();
  const accountingSync = getInvoiceAccountingSyncView(invoice as any);
  const paymentProvider = getPaymentProviderStatus();
  const latestPaymentLink = await getLatestInvoicePaymentLink(invoice.id);

  async function createPaymentLinkAction() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageInvoiceFeature(context.user)) return;
    await createInvoicePaymentLink({
      workspaceId: context.workspace.id,
      invoiceId: params.invoiceId,
      user: context.user
    });
    revalidatePath(`/app/invoices/${params.invoiceId}`);
    revalidatePath("/app/settings/billing");
  }

  return (
    <AppShell title="Invoices">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Billing"
          title="Editable invoice document"
          description={`${invoice.invoiceNumber} for ${invoice.clientName}. Review required before sending or marking as paid.`}
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
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Accounting sync status</p>
              <p className="mt-1 text-xs text-slate-400">Billing-safe sync/export only. No sensitive migration data is included.</p>
            </div>
            <StatusPill tone={accountingSync.state === "dry_run_ready" ? "success" : accountingSync.state === "manual_csv_ready" ? "warning" : "neutral"}>
              {accountingSync.state.replaceAll("_", " ")}
            </StatusPill>
          </div>
          <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
            <p>Provider: <span className="text-white">{accountingSync.providerName}</span></p>
            <p>Mode: <span className="text-white">{accountingSync.mode.replaceAll("_", " ")}</span></p>
            <p>Last attempt: <span className="text-white">{accountingSync.lastAttemptAt ? new Date(accountingSync.lastAttemptAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
          </div>
          {accountingSync.lastErrorSummary ? <p className="text-xs text-slate-400">Last error: {accountingSync.lastErrorSummary}</p> : null}
        </Card>
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Invoice payment link</p>
              <p className="mt-1 text-xs text-slate-400">Optional Stripe payment flow only. No visa or document data is sent to Stripe metadata.</p>
            </div>
            <StatusPill tone={latestPaymentLink?.paymentStatus === "PAID" ? "success" : latestPaymentLink?.paymentStatus === "OPEN" ? "info" : paymentProvider.configured ? "warning" : "neutral"}>
              {latestPaymentLink?.paymentStatus?.replaceAll("_", " ") || (paymentProvider.configured ? "not created" : "not configured")}
            </StatusPill>
          </div>
          <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
            <p>Provider: <span className="text-white">{paymentProvider.providerName}</span></p>
            <p>Link mode: <span className="text-white">{paymentProvider.configured ? "Stripe checkout" : "Disabled until configured"}</span></p>
            <p>Last created: <span className="text-white">{latestPaymentLink ? new Date(latestPaymentLink.createdAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
          </div>
          {!paymentProvider.configured ? (
            <p className="text-xs text-slate-400">Stripe payments are not configured.</p>
          ) : null}
          {latestPaymentLink?.paymentUrl ? (
            <p className="text-xs text-slate-400">A client-safe payment link has been prepared through Stripe. Review invoice details before sharing externally.</p>
          ) : null}
          {canManageInvoiceFeature(context.user) ? (
            <form action={createPaymentLinkAction}>
              <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                {latestPaymentLink ? "Create new payment link" : "Create payment link"}
              </button>
            </form>
          ) : null}
        </Card>
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
