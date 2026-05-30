import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import {
  getEmailSyncIntegrationView,
  runEmailSyncConnectionTest
} from "@/lib/services/email-sync/email-sync-integration";
import { disconnectEmailSyncProvider } from "@/lib/services/email-sync/email-sync-oauth";

export default async function EmailSyncIntegrationPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Email sync">
        <PageHeader title="Email sync unavailable" description="Your company administrator manages mailbox integration setup." />
      </AppShell>
    );
  }

  const integration = await getEmailSyncIntegrationView(context.workspace.id, context.user.id);

  async function testConnection() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await runEmailSyncConnectionTest({ workspaceId: context.workspace.id, userId: context.user.id });
    revalidatePath("/app/settings/integrations/email-sync");
    revalidatePath("/app/settings/integrations");
  }

  async function disconnectProvider() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await disconnectEmailSyncProvider({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      provider: integration.provider.providerName as "gmail" | "microsoft" | "disabled"
    });
    revalidatePath("/app/settings/integrations/email-sync");
    revalidatePath("/app/settings/integrations");
  }

  return (
    <AppShell title="Email sync">
      <div className="space-y-6">
        <PageHeader
          eyebrow="EMAIL SYNC"
          title="Gmail / Outlook mailbox sync"
          description="Email sync uses minimised metadata by default. Sensitive client documents and visa details should be shared through the secure portal."
          action={<Link href={"/app/settings/integrations" as any} className="text-sm text-cyan-300 hover:text-white">Back to integrations</Link>}
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Provider status</h2>
                <p className="mt-1 text-sm text-slate-400">{integration.provider.providerName}</p>
              </div>
              <StatusPill tone={integration.provider.state === "disabled" ? "neutral" : integration.provider.configured && integration.connection?.connected ? "success" : "warning"}>
                {integration.provider.state === "disabled" ? "Disabled" : integration.provider.configured && integration.connection?.connected ? "Connected" : integration.provider.configured ? "Needs connection" : "Not configured"}
              </StatusPill>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <p>Gmail configured: <span className="text-white">{integration.env.gmailConfigured ? "Yes" : "No"}</span></p>
              <p>Microsoft configured: <span className="text-white">{integration.env.microsoftConfigured ? "Yes" : "No"}</span></p>
              <p>Connected account: <span className="text-white">{integration.connection?.connectedAccountLabel || "Not connected"}</span></p>
              <p>Last successful action: <span className="text-white">{integration.connection?.lastSuccessfulActionAt ? new Date(integration.connection.lastSuccessfulActionAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
              <p>Last sync: <span className="text-white">{integration.connection?.lastSyncAt ? new Date(integration.connection.lastSyncAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
              <p>Last error: <span className="text-white">{integration.connection?.lastErrorSummary || integration.provider.lastErrorSummary || "No recent redacted error recorded"}</span></p>
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
              {integration.authorizationUrl ? (
                <a href={integration.authorizationUrl} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                  Connect mailbox
                </a>
              ) : (
                <button disabled className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-slate-500">
                  Email sync provider not configured
                </button>
              )}
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
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Safe dry-run email payload preview</h2>
            <p className="text-sm text-slate-400">This preview is privacy-safe only. It does not claim a live Gmail or Outlook email was sent.</p>
            <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-200">{JSON.stringify(integration.dryRunPreview, null, 2)}</pre>
            <p className="text-xs text-slate-400">Safety note: Email sync uses minimised metadata by default. Sensitive client documents and visa details should be shared through the secure portal.</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Manual import guardrail</h2>
            <p className="text-sm text-slate-400">Thread metadata can be linked to a matter. Full body import requires explicit review.</p>
            <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-200">{JSON.stringify(integration.dryRunImportPreview, null, 2)}</pre>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Recent mailbox metadata</h2>
            <div className="space-y-3">
              {integration.recentThreads.length ? integration.recentThreads.map((thread) => (
                <div key={thread.externalThreadId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{thread.subjectPreview}</p>
                  <p className="mt-1 text-xs text-slate-400">{thread.fromPreview} · {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString("en-AU") : "No timestamp"}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No mailbox metadata has been listed yet. This remains a safe disabled state when no provider is configured.</p>}
            </div>
          </Card>
        </section>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Recent email sync audit</h2>
          <div className="space-y-3">
            {integration.recentAudit.length ? integration.recentAudit.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                <p className="font-medium text-white">{event.action}</p>
                <p className="mt-1 text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
              </div>
            )) : <p className="text-sm text-slate-400">No mailbox sync events have been recorded yet.</p>}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
