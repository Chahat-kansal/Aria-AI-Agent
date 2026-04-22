import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/app/blocks/stat-card";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getOverviewData } from "@/lib/data/workspace-repository";

export default async function OverviewPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return <AppShell title="Overview"><PageHeader title="Workspace setup required" subtitle="Create or join a workspace to see live operational data." /></AppShell>;
  }

  const { matters, activeMatterCount, averageReadiness, openIssueCount, updates, tasks } = await getOverviewData(context.workspace.id);

  return (
    <AppShell title="Overview">
      <PageHeader title="Operations Overview" subtitle="Live workspace snapshot of submission readiness, flagged inconsistencies, and update impact." />
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Active matters" value={`${activeMatterCount}`} hint="Database-backed workspace files" />
        <StatCard label="Avg readiness" value={`${averageReadiness}%`} hint="Review-required score" />
        <StatCard label="Open validation issues" value={`${openIssueCount}`} hint="Prioritize critical first" />
        <StatCard label="Official updates" value={`${updates.length}`} hint="Stored source-linked records" />
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Matters needing attention</h3>
          <div className="mt-3 space-y-2">
            {matters.length ? matters.map((matter) => (
              <div key={matter.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{matter.client.firstName} {matter.client.lastName}</p>
                  <p className="text-xs text-muted">Subclass {matter.visaSubclass} · {formatEnum(matter.stage)}</p>
                </div>
                <StatusChip label={matter.readinessScore < 70 || matter.validationIssues.length ? "high" : "low"} />
              </div>
            )) : (
              <p className="rounded-lg border border-border p-4 text-sm text-muted">No matters yet. Create a matter to start tracking readiness and review work.</p>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold">Upcoming tasks</h3>
          <div className="mt-3 space-y-2">
            {tasks.length ? tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted">Due {formatDate(task.dueDate)} · {task.matter.client.firstName} {task.matter.client.lastName}</p>
                </div>
                <StatusChip label={formatEnum(task.priority)} />
              </div>
            )) : (
              <p className="rounded-lg border border-border p-4 text-sm text-muted">No open tasks are recorded for this workspace.</p>
            )}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
