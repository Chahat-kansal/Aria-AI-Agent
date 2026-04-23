import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getTasksData } from "@/lib/data/workspace-repository";

export default async function TasksPage() {
  const context = await getCurrentWorkspaceContext();
  const tasks = context ? await getTasksData(context.workspace.id) : [];

  return (
    <AppShell title="Tasks">
      <PageHeader title="Task Board" subtitle="Matter-linked operational tasks with owner, priority, due date, and completion status." />
      <Card>
        <div className="mb-3 flex gap-2 text-xs"><span className="rounded bg-white/60 px-2 py-1">Open tasks</span><span className="rounded bg-white/60 px-2 py-1">Due date order</span><span className="rounded bg-white/60 px-2 py-1">Database-backed</span></div>
        <div className="space-y-2">
          {tasks.length ? tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted">{task.matter.client.firstName} {task.matter.client.lastName} · Due {formatDate(task.dueDate)} · Owner {task.assignedToUser.name}</p>
              </div>
              <div className="flex items-center gap-2"><StatusChip label={formatEnum(task.priority)} /><StatusChip label={formatEnum(task.status)} /></div>
            </div>
          )) : (
            <p className="rounded-lg border border-border p-4 text-sm text-muted">No tasks are stored for this workspace yet.</p>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
