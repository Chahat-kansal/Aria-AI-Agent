import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getEsignIntegrationView, runEsignProviderConnectionTest } from "@/lib/services/esign/esign-integration";
import { getEsignProviderAdapter } from "@/lib/services/esign/esign-provider-router";
import { getEsignProviderName } from "@/lib/providers/esign-provider";

export default async function EsignIntegrationPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Client acknowledgement">
        <PageHeader title="Client acknowledgement unavailable" description="Your company administrator manages acknowledgement provider setup." />
      </AppShell>
    );
  }

  const integration = await getEsignIntegrationView(context.workspace.id, context.user.id);

  async function testConnection() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await runEsignProviderConnectionTest({ workspaceId: context.workspace.id, userId: context.user.id });
    revalidatePath("/app/settings/integrations/esign");
    revalidatePath("/app/settings/integrations");
  }

  async function disconnectProvider() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await getEsignProviderAdapter().disconnect({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      provider: getEsignProviderName()
    });
    revalidatePath("/app/settings/integrations/esign");
    revalidatePath("/app/settings/integrations");
  }

  return (
    <AppShell title="Client acknowledgement">
      <div className="space-y-6">
        <PageHeader
          eyebrow="CLIENT ACKNOWLEDGEMENT"
          title="Internal acknowledgement and external e-sign setup"
          description="Internal acknowledgements are confirmations for agent review. They are not represented as legal e-signatures unless an external provider is configured and legally reviewed."
          action={<Link href={"/app/settings/integrations" as any} className="text-sm text-cyan-300 hover:text-white">Back to integrations</Link>}
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Provider status</h2>
                <p className="mt-1 text-sm text-slate-400">{integration.provider.providerName}</p>
              </div>
              <StatusPill tone={integration.provider.state === "disabled" ? "neutral" : integration.provider.configured ? "success" : "warning"}>
                {integration.provider.state === "disabled" ? "Disabled" : integration.provider.configured ? "Configured" : "Not configured"}
              </StatusPill>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <p>Internal acknowledgement: <span className="text-white">Available</span></p>
              <p>DocuSign configured: <span className="text-white">{integration.env.docusignConfigured ? "Yes" : "No"}</span></p>
              <p>Connection state: <span className="text-white">{integration.connection?.connectionState?.replaceAll("_", " ") || integration.provider.connectionState.replaceAll("_", " ")}</span></p>
              <p>Connected account: <span className="text-white">{integration.connection?.connectedAccountLabel || "Not connected"}</span></p>
              <p>Last request: <span className="text-white">{integration.lastRequest ? `${integration.lastRequest.title} (${integration.lastRequest.status.replaceAll("_", " ")})` : "No request recorded"}</span></p>
              <p>Last error: <span className="text-white">{integration.connection?.lastErrorSummary || integration.lastRequest?.lastErrorSummary || "No recent redacted error recorded"}</span></p>
              <p>Retainer template: <span className="text-white">{integration.retainerTemplateConfigured ? "Configured" : "Retainer template not configured."}</span></p>
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

            <div className="flex flex-wrap gap-3">
              <form action={testConnection}>
                <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                  Test connection
                </button>
              </form>
              {integration.connection?.connected ? (
                <form action={disconnectProvider}>
                  <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                    Disconnect
                  </button>
                </form>
              ) : null}
              <Link href={"/app/settings/integrations" as any} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                Open provider hub
              </Link>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Dry-run external envelope preview</h2>
            <p className="text-sm text-slate-400">This preview is privacy-safe only. It does not claim a live external envelope was created.</p>
            <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-200">{JSON.stringify(integration.dryRunExternalPreview, null, 2)}</pre>
            <p className="text-xs text-slate-400">Safety note: Internal acknowledgements are confirmations for agent review. They are not represented as legal e-signatures unless an external provider is configured and legally reviewed.</p>
          </Card>
        </section>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Recent acknowledgement audit</h2>
          <div className="space-y-3">
            {integration.recentAudit.length ? integration.recentAudit.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                <p className="font-medium text-white">{event.action}</p>
                <p className="mt-1 text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
              </div>
            )) : <p className="text-sm text-slate-400">No acknowledgement integration events have been recorded yet.</p>}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
