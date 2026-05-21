import Link from "next/link";
import { InvoiceStatus } from "@prisma/client";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { prisma } from "@/lib/prisma";
import { canManageInvoiceFeature, canManageInvoiceSettingsFeature, canViewInvoiceFeature, isInvoiceOverdue, scopedInvoiceWhere } from "@/lib/services/invoices";
import { formatCurrency } from "@/lib/invoice-calculations";
import { billingStageTemplates, buildBillingSafetySummary } from "@/lib/services/billing-safety";

export default async function InvoicesPage({
  searchParams
}: {
  searchParams?: { status?: string; q?: string };
}) {
  const context = await requireCurrentWorkspaceContext();
  if (!canViewInvoiceFeature(context.user)) {
    return (
      <AppShell title="Invoices">
        <div className="space-y-6">
          <PageHeader title="Invoices" description="Invoice access is controlled by your workspace role and permissions." />
          <EmptyState title="Invoice access is disabled" description="Ask a Company Owner or administrator to enable invoice permissions for your account." />
        </div>
      </AppShell>
    );
  }

  const status = searchParams?.status || "";
  const q = searchParams?.q || "";
  const invoices = await prisma.invoice.findMany({
    where: {
      ...scopedInvoiceWhere(context.user),
      ...(status ? { status: status as InvoiceStatus } : {}),
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q, mode: "insensitive" } },
              { clientName: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: {
      matter: { include: { client: true } },
      createdByUser: true
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }]
  });

  const stats = {
    total: invoices.length,
    sent: invoices.filter((invoice) => invoice.status === InvoiceStatus.SENT).length,
    paid: invoices.filter((invoice) => invoice.status === InvoiceStatus.PAID).length,
    overdue: invoices.filter((invoice) => isInvoiceOverdue(invoice)).length
  };
  const billingSafety = buildBillingSafetySummary(invoices);

  return (
    <AppShell title="Invoices">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Billing"
          title="Invoices"
          description="Create review-required invoices from real workspace pricing, client matters, and firm branding."
          action={
            <div className="flex flex-wrap gap-3">
              {canManageInvoiceSettingsFeature(context.user) ? (
                <Link href={"/app/invoices/setup" as any} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 hover:bg-white/10">
                  Invoice setup
                </Link>
              ) : null}
              {canManageInvoiceFeature(context.user) ? (
                <>
                  <Link href={"/app/invoices/generate" as any} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 hover:bg-white/10">
                    Generate with Aria
                  </Link>
                  <Link href={"/app/invoices/new" as any} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow hover:opacity-95">
                    New invoice
                  </Link>
                </>
              ) : null}
            </div>
          }
        />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Visible invoices" value={stats.total} hint="Current workspace scope" />
          <StatCard label="Sent" value={stats.sent} hint="Issued to clients" tone="info" />
          <StatCard label="Paid" value={stats.paid} hint="Completed invoice lifecycle" tone="success" />
          <StatCard label="Overdue" value={stats.overdue} hint="Needs follow-up or reconciliation" tone={stats.overdue ? "warning" : "info"} />
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
          <form className="grid gap-4 md:grid-cols-[0.8fr_0.35fr_auto]">
            <input name="q" defaultValue={q} placeholder="Search invoice number or client" />
            <select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {Object.values(InvoiceStatus).map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ").toLowerCase()}</option>
              ))}
            </select>
            <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 hover:bg-white/10">
              Filter
            </button>
          </form>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5">
            <p className="text-sm font-semibold text-amber-100">Trust-safe billing guardrail</p>
            <p className="mt-2 text-sm leading-6 text-amber-100/85">
              Aria tracks invoice stages and payment status only. It does not store card or bank details, does not process payments directly, and does not claim trust-accounting compliance.
            </p>
            <p className="mt-3 rounded-2xl border border-amber-200/20 bg-black/10 p-3 text-xs leading-5 text-amber-100/85">{billingSafety.warnings[0]}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Stage-based invoice support</p>
                <p className="mt-1 text-sm text-slate-400">Use firm-reviewed stages without exposing private document content in invoice wording.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{formatCurrency(billingSafety.unpaidCents, "AUD")} unpaid visible</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {billingStageTemplates.map((stage) => (
                <div key={stage.stage} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                  <p className="font-medium text-white">{stage.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{stage.description}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-cyan-200">Firm review required</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="aria-table-wrap">
          {invoices.length ? (
            <table className="w-full text-sm">
              <thead className="aria-table-head">
                <tr>
                  <th className="aria-table-th">Invoice</th>
                  <th className="aria-table-th">Client</th>
                  <th className="aria-table-th">Matter</th>
                  <th className="aria-table-th">Issue</th>
                  <th className="aria-table-th">Due</th>
                  <th className="aria-table-th">Status</th>
                  <th className="aria-table-th">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="aria-table-row">
                    <td className="aria-table-td">
                      <Link href={`/app/invoices/${invoice.id}` as any} className="font-medium text-cyan-300 hover:text-cyan-200">
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="aria-table-td">{invoice.clientName}</td>
                    <td className="aria-table-td">{invoice.matter ? `${invoice.matter.client.firstName} ${invoice.matter.client.lastName} - ${invoice.matter.title}` : "Not linked"}</td>
                    <td className="aria-table-td">{invoice.issueDate.toLocaleDateString("en-AU")}</td>
                    <td className="aria-table-td">{invoice.dueDate.toLocaleDateString("en-AU")}</td>
                    <td className="aria-table-td">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-300">
                        {isInvoiceOverdue(invoice) ? "OVERDUE" : invoice.status}
                      </span>
                    </td>
                    <td className="aria-table-td">{formatCurrency(invoice.totalCents, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No invoices yet"
                description="Create the first real invoice from workspace pricing and client data, or configure branding before using Aria generation."
                action={
                  canManageInvoiceFeature(context.user)
                    ? <Link href={"/app/invoices/new" as any} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow">Create invoice</Link>
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
