import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getOverview } from "@/lib/data/demo-repository";

export default function TasksPage() {
  const { tasks } = getOverview();

  return (
    <AppShell title="Tasks">
      <PageHeader title="Task Board" subtitle="Matter-linked operational tasks with owner, priority, due date, and completion status." />
      <Card>
        <div className="mb-3 flex gap-2 text-xs"><span className="rounded bg-[#111a2b] px-2 py-1">Open tasks</span><span className="rounded bg-[#111a2b] px-2 py-1">Due this week</span><span className="rounded bg-[#111a2b] px-2 py-1">Assigned to me</span></div>
        <div className="space-y-2">{tasks.map((task) => <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="font-medium">{task.title}</p><p className="text-xs text-muted">Matter {task.matterId} · Due {task.dueDate}</p></div><div className="flex items-center gap-2"><StatusChip label={task.priority} /><StatusChip label={task.status} /></div></div>)}</div>
      </Card>
    </AppShell>
  );
}
