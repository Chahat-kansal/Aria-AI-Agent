import { AppShell } from "@/components/app/app-shell";
import { DeadlineCommandCentre } from "@/components/app/deadline-command-centre";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { getMatterOptionsData } from "@/lib/data/workspace-repository";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getDeadlineDashboard } from "@/lib/services/deadlines/deadline-service";
import { canAccessDeadlineCentre } from "@/lib/services/deadlines/deadline-policy";
import { hasPermission } from "@/lib/services/roles";

export default async function DeadlinesPage({
  searchParams
}: {
  searchParams?: { matterId?: string };
}) {
  const context = await requireCurrentWorkspaceContext();
  if (!canAccessDeadlineCentre(context.user)) {
    return (
      <AppShell title="Deadlines">
        <div className="space-y-6">
          <PageHeader
            eyebrow="DEADLINES"
            title="Deadline command centre unavailable"
            description="You do not have permission to view or manage workspace deadlines."
          />
        </div>
      </AppShell>
    );
  }
  const [dashboard, matters, users] = await Promise.all([
    getDeadlineDashboard({
      workspaceId: context.workspace.id,
      user: context.user,
      matterId: searchParams?.matterId || null
    }),
    getMatterOptionsData(context.workspace.id, context.user),
    hasPermission(context.user, "can_manage_team")
      ? prisma.user.findMany({
          where: { workspaceId: context.workspace.id, status: { not: "DISABLED" } },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
          take: 50
        })
      : Promise.resolve([{ id: context.user.id, name: context.user.name, email: context.user.email }])
  ]);

  return (
    <AppShell title="Deadlines">
      <div className="space-y-6">
        <PageHeader
          eyebrow="DEADLINES"
          title="Deadline command centre"
          description="Track upcoming, overdue, and review-required matter deadlines with generic reminder previews and redacted audit history."
        />
        <DeadlineCommandCentre
          dashboard={dashboard}
          matters={matters.map((matter) => ({
            id: matter.id,
            label: `${matter.client.firstName} ${matter.client.lastName} - ${matter.title}`,
            matterReference: matter.matterReference
          }))}
          users={users}
          initialMatterId={searchParams?.matterId || null}
        />
      </div>
    </AppShell>
  );
}
