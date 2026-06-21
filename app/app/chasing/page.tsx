import { AppShell } from "@/components/app/app-shell";
import { ClientChasingPanel } from "@/components/app/client-chasing-panel";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getClientChasingDashboard } from "@/lib/services/chasing/client-chasing-service";

export default async function ChasingPage() {
  const context = await requireCurrentWorkspaceContext();
  const dashboard = await getClientChasingDashboard(context.workspace.id, context.user);

  return (
    <AppShell title="Client chasing">
      <div className="space-y-6">
        <PageHeader
          eyebrow="CLIENT CHASING"
          title="Safe client chasing automation"
          description="Preview reminders before sending, keep auto-send disabled by default, and rely only on generic secure-portal wording with consent, opt-out, and rate-limit checks."
        />
        <ClientChasingPanel
          settings={dashboard.settings}
          pending={dashboard.pending}
          history={dashboard.history}
          audit={dashboard.audit.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))}
          preferences={dashboard.preferences}
        />
      </div>
    </AppShell>
  );
}
