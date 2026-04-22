import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getSettingsData } from "@/lib/data/workspace-repository";

function ConfigStatus({ configured }: { configured: boolean }) {
  return <StatusChip label={configured ? "Configured" : "Disabled"} />;
}

export default async function SettingsPage() {
  const context = await getCurrentWorkspaceContext();
  const workspace = context ? await getSettingsData(context.workspace.id) : null;

  return (
    <AppShell title="Settings">
      <PageHeader title="Workspace Settings" subtitle="Review real workspace, team, and production configuration state. Disabled items are not active runtime paths." />
      {workspace ? (
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="font-semibold">Workspace profile</h3>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <p>Name: <span className="text-white">{workspace.name}</span></p>
              <p>Slug: <span className="text-white">{workspace.slug}</span></p>
              <p>Plan: <span className="text-white">{formatEnum(workspace.plan)}</span></p>
              <p>Created: <span className="text-white">{formatDate(workspace.createdAt)}</span></p>
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold">Team members & roles</h3>
            <div className="mt-3 space-y-2">
              {workspace.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <div><p>{user.name}</p><p className="text-xs text-muted">{user.email}</p></div>
                  <StatusChip label={formatEnum(user.role)} />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold">AI settings</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Provider adapter</span>
              <ConfigStatus configured={Boolean(process.env.AI_PROVIDER)} />
            </div>
            <p className="mt-3 text-xs text-muted">AI output remains AI-assisted, source-linked where available, and review required.</p>
          </Card>
          <Card>
            <h3 className="font-semibold">Storage settings</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Persistent storage provider</span>
              <ConfigStatus configured={Boolean(process.env.STORAGE_PROVIDER && process.env.STORAGE_PROVIDER !== "local")} />
            </div>
            <p className="mt-3 text-xs text-muted">{workspace._count.documents} document metadata records are stored in Postgres.</p>
          </Card>
          <Card>
            <h3 className="font-semibold">Update source settings</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Scheduled ingestion</span>
              <ConfigStatus configured={process.env.OFFICIAL_UPDATE_SCHEDULER_ENABLED === "true"} />
            </div>
            <p className="mt-3 text-xs text-muted">Live ingestion is intentionally disabled until official connectors are configured.</p>
          </Card>
          <Card>
            <h3 className="font-semibold">Billing</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Plan management</span>
              <StatusChip label="Coming soon" />
            </div>
            <p className="mt-3 text-xs text-muted">Billing is not active in this phase and no fake subscription data is shown.</p>
          </Card>
        </section>
      ) : (
        <Card><p className="text-sm text-muted">No workspace settings are available until your user is linked to a workspace.</p></Card>
      )}
    </AppShell>
  );
}
