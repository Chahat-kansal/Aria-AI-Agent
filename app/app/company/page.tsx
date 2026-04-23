import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { CompanyProfileForm } from "@/components/app/company-profile-form";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatEnum, getCompanyProfileData } from "@/lib/data/workspace-repository";
import { roleLabel } from "@/lib/services/roles";

export default async function CompanyPage() {
  const context = await getCurrentWorkspaceContext();
  const workspace = context ? await getCompanyProfileData(context.workspace.id) : null;

  return (
    <AppShell title="Company">
      <PageHeader title="Company Profile" subtitle="Manage the real business profile shown across the workspace and used for migration operations." />
      {workspace ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
          <Card>
            <h3 className="font-semibold">Business details</h3>
            <p className="mb-4 mt-1 text-sm text-muted">Keep your trading identity, contact information, branding, and timezone current for team workflows.</p>
            <CompanyProfileForm workspace={workspace} />
          </Card>
          <div className="space-y-4">
            <Card>
              <h3 className="font-semibold">Workspace summary</h3>
              <div className="mt-3 space-y-2 text-sm">
                <p><span className="text-muted">Plan:</span> {formatEnum(workspace.plan)}</p>
                <p><span className="text-muted">Slug:</span> {workspace.slug}</p>
                <p><span className="text-muted">Team members:</span> {workspace.users.length}</p>
                <p><span className="text-muted">Clients:</span> {workspace._count.clients}</p>
                <p><span className="text-muted">Matters:</span> {workspace._count.matters}</p>
                <p><span className="text-muted">Documents:</span> {workspace._count.documents}</p>
              </div>
            </Card>
            <Card>
              <h3 className="font-semibold">Team overview</h3>
              <div className="mt-3 space-y-2">
                {workspace.users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between rounded-lg border border-border bg-white/50 p-2 text-sm">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>
                    <StatusChip label={roleLabel(user.role)} />
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h3 className="font-semibold">Branding</h3>
              {workspace.logoUrl ? (
                <a href={workspace.logoUrl} className="mt-3 inline-flex break-all rounded-lg border border-border bg-white/50 px-3 py-2 text-sm text-accent">
                  Logo URL stored
                </a>
              ) : (
                <p className="mt-2 text-sm text-muted">No logo URL is stored yet. Add one above when your firm is ready to show brand assets in client-facing workflows.</p>
              )}
            </Card>
          </div>
        </section>
      ) : (
        <Card><p className="text-sm text-muted">No company profile is available until your user is linked to a workspace.</p></Card>
      )}
    </AppShell>
  );
}
