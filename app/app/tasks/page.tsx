import { AppShell } from "@/components/app/app-shell";
import { OfflineTaskBoard } from "@/components/app/tasks/offline-task-board";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { getMatterOptionsData } from "@/lib/data/workspace-repository";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { listTasksForUser, serializeTaskForClient } from "@/lib/services/offline/offline-task-sync";
import { hasPermission } from "@/lib/services/roles";

export default async function TasksPage() {
  const context = await requireCurrentWorkspaceContext();
  const [tasks, matters, users] = await Promise.all([
    listTasksForUser(context.workspace.id, context.user),
    getMatterOptionsData(context.workspace.id, context.user),
    hasPermission(context.user, "can_manage_team")
      ? prisma.user.findMany({
          where: { workspaceId: context.workspace.id, status: { not: "DISABLED" } },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
          take: 40
        })
      : Promise.resolve([{ id: context.user.id, name: context.user.name, email: context.user.email }])
  ]);

  return (
    <AppShell title="Tasks">
      <div className="space-y-6">
        <PageHeader
          eyebrow="TASKS"
          title="Offline-friendly task board"
          description="Create, edit, complete, and sync low-risk task metadata. Sensitive notes, documents, AI drafts, and private portal data stay online-only."
        />
        <OfflineTaskBoard
          workspaceId={context.workspace.id}
          currentUserId={context.user.id}
          initialTasks={tasks.map(serializeTaskForClient)}
          matters={matters.map((matter) => ({
            id: matter.id,
            label: `${matter.client.firstName} ${matter.client.lastName} - ${matter.title}`,
            matterReference: matter.matterReference
          }))}
          users={users}
        />
      </div>
    </AppShell>
  );
}
