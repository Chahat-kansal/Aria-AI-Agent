import { AppShell } from "@/components/app/app-shell";
import { MatterHealthDashboard } from "@/components/app/matter-health-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatterHealth } from "@/lib/services/matter-health/matter-health-policy";
import { getMatterHealthDashboard } from "@/lib/services/matter-health/matter-health-service";

export default async function MatterHealthPage({
  searchParams
}: {
  searchParams?: { matterId?: string };
}) {
  const context = await requireCurrentWorkspaceContext();

  if (!canAccessMatterHealth(context.user)) {
    return (
      <AppShell title="Matter health">
        <div className="space-y-6">
          <PageHeader
            eyebrow="MATTER HEALTH"
            title="Matter health unavailable"
            description="You do not have permission to view matter health signals in this workspace."
          />
        </div>
      </AppShell>
    );
  }

  const dashboard = await getMatterHealthDashboard({
    workspaceId: context.workspace.id,
    user: context.user,
    matterId: searchParams?.matterId || null
  });

  return (
    <AppShell title="Matter health">
      <div className="space-y-6">
        <PageHeader
          eyebrow="MATTER HEALTH"
          title="Matter health score"
          description="Review advisory operational risk, missing information, overdue actions, and review blockers without treating the score as legal advice or a visa outcome prediction."
        />
        {dashboard ? <MatterHealthDashboard dashboard={dashboard} initialMatterId={searchParams?.matterId || null} /> : null}
      </div>
    </AppShell>
  );
}
