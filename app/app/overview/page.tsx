import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/app/blocks/stat-card";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getOverview } from "@/lib/data/demo-repository";

export default function OverviewPage() {
  const { matters, issues, updates, tasks } = getOverview();

  return (
    <AppShell title="Overview">
      <PageHeader title="Operations Overview" subtitle="Live workspace snapshot of submission readiness, flagged inconsistencies, and update impact." />
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Active matters" value={`${matters.length}`} hint="Across all stages" />
        <StatCard label="Avg readiness" value={`${Math.round(matters.reduce((a,m)=>a+m.readiness,0)/matters.length)}%`} hint="Review-required score" />
        <StatCard label="Open validation issues" value={`${issues.filter((x)=>x.resolutionStatus === "Open").length}`} hint="Prioritize critical first" />
        <StatCard label="Recent official updates" value={`${updates.length}`} hint="Source-linked feed" />
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Matters needing attention</h3>
          <div className="mt-3 space-y-2">
            {matters.slice(0, 6).map((matter) => (
              <div key={matter.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{matter.client}</p>
                  <p className="text-xs text-muted">Subclass {matter.visaSubclass} · {matter.stage}</p>
                </div>
                <StatusChip label={matter.readiness < 70 ? "high" : "low"} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold">Upcoming tasks</h3>
          <div className="mt-3 space-y-2">
            {tasks.slice(0, 6).map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted">Due {task.dueDate} · Matter {task.matterId}</p>
                </div>
                <StatusChip label={task.priority} />
              </div>
            ))}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
