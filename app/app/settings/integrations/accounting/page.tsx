import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getAccountingIntegrationView, listWorkspaceInvoiceAccountingStates, runAccountingInvoiceDryRun } from "@/lib/services/accounting-integration";
import { formatCurrency } from "@/lib/invoice-calculations";

export default async function AccountingIntegrationPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Accounting integration">
        <PageHeader title="Accounting integration unavailable" description="Your company administrator manages accounting provider setup." />
      </AppShell>
    );
  }

  const [integration, invoiceStates] = await Promise.all([
    getAccountingIntegrationView(context.workspace.id),
    listWorkspaceInvoiceAccountingStates(context.workspace.id, context.user)
  ]);

  async function runDryRun(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    const invoiceId = String(formData.get("invoiceId") || "");
    if (!invoiceId) return;
    await runAccountingInvoiceDryRun({ workspaceId: context.workspace.id, invoiceId, user: context.user });
  }

  return (
    <AppShell title="Accounting integration">
      <div className="space-y-6">
        <PageHeader
          eyebrow="ACCOUNTING"
          title="Xero / MYOB accounting integration"
          description="Operational billing sync only. Trust accounting obligations must be reviewed with an accountant/legal professional."
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Provider status</h2>
                <p className="mt-1 text-sm text-slate-400">{integration.provider.providerName}</p>
              </div>
              <StatusPill tone={integration.provider.state === "disabled" ? "neutral" : integration.provider.configured && integration.provider.connected ? "success" : "warning"}>
                {integration.provider.state === "disabled" ? "Disabled" : integration.provider.configured && integration.provider.connected ? "Connected" : integration.provider.configured ? "Needs connection" : "Not configured"}
              </StatusPill>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Connection state: <span className="text-white">{integration.provider.connectionState.replaceAll("_", " ")}</span></p>
              <p>Last successful action: <span className="text-white">{integration.provider.lastSuccessfulActionAt ? new Date(integration.provider.lastSuccessfulActionAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
              <p>Last sync: <span className="text-white">{integration.provider.lastSyncAt ? new Date(integration.provider.lastSyncAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
              <p>Last error: <span className="text-white">{integration.provider.lastErrorSummary || "No recent redacted error recorded"}</span></p>
            </div>
            {integration.provider.missingEnv.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                Missing environment values: <span className="text-white">{integration.provider.missingEnv.join(", ")}</span>
              </div>
            ) : null}
            <ul className="space-y-2 text-xs leading-6 text-slate-400">
              {integration.provider.requiredSetupSteps.map((step) => <li key={step}>{step}</li>)}
              {integration.provider.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Recent integration audit</h2>
            <div className="space-y-3">
              {integration.recentAudit.length ? integration.recentAudit.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{event.action}</p>
                  <p className="mt-1 text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No accounting integration events have been recorded yet.</p>}
            </div>
          </Card>
        </section>

        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Invoice sync state</h2>
            <p className="mt-1 text-sm text-slate-400">Dry-run validates billing-safe payloads. It does not claim a live accounting sync succeeded.</p>
          </div>
          <div className="space-y-3">
            {invoiceStates.length ? invoiceStates.map((invoice) => (
              <form key={invoice.id} action={runDryRun} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 xl:flex-row xl:items-center xl:justify-between">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <div>
                  <p className="font-medium text-white">{invoice.invoiceNumber} · {invoice.clientName}</p>
                  <p className="mt-1 text-sm text-slate-400">{formatCurrency(invoice.totalCents, invoice.currency)}</p>
                  <p className="mt-2 text-xs text-slate-400">State: {invoice.sync.state.replaceAll("_", " ")} · Mode: {invoice.sync.mode.replaceAll("_", " ")}</p>
                </div>
                <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                  Run dry-run export
                </button>
              </form>
            )) : <p className="text-sm text-slate-400">Create an invoice before testing accounting payload export.</p>}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
