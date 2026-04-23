import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { ProfileForm } from "@/components/app/profile-form";
import { SignOutButton } from "@/components/app/sign-out-button";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatEnum } from "@/lib/data/workspace-repository";
import { roleDescription, roleLabel } from "@/lib/services/roles";

export default async function ProfilePage() {
  const context = await getCurrentWorkspaceContext();

  return (
    <AppShell title="Profile">
      <PageHeader title="Your Profile" subtitle="Your identity, role, workspace, and account controls for Aria Migration operations." />
      {context ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <Card>
            <h3 className="font-semibold">Account details</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-lg border border-border bg-white/50 p-3">
                <p className="text-muted">Signed in as</p>
                <p className="font-medium">{context.user.email}</p>
              </div>
              <div className="rounded-lg border border-border bg-white/50 p-3">
                <p className="text-muted">Role</p>
                <StatusChip label={roleLabel(context.user.role)} />
                <p className="mt-2 text-xs text-muted">{roleDescription(context.user.role)}</p>
              </div>
              <div className="rounded-lg border border-border bg-white/50 p-3">
                <p className="text-muted">Visibility scope</p>
                <p className="font-medium">{formatEnum(context.user.visibilityScope)}</p>
              </div>
              {context.user.jobTitle ? (
                <div className="rounded-lg border border-border bg-white/50 p-3">
                  <p className="text-muted">Job title</p>
                  <p className="font-medium">{context.user.jobTitle}</p>
                </div>
              ) : null}
            </div>
            <div className="mt-5">
              <ProfileForm name={context.user.name} />
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold">Workspace context</h3>
            <div className="mt-4 space-y-3 text-sm">
              <p><span className="text-muted">Business:</span> {context.workspace.name}</p>
              <p><span className="text-muted">Plan:</span> {formatEnum(context.workspace.plan)}</p>
              <p><span className="text-muted">Timezone:</span> {context.workspace.timezone}</p>
              <Link href="/app/company" className="inline-flex rounded-lg border border-border px-3 py-2 text-sm text-accent">Open company profile</Link>
            </div>
            <div className="mt-6 border-t border-border pt-4">
              <h4 className="font-medium">Account access</h4>
              <p className="mb-3 mt-1 text-sm text-muted">Password changes use the configured authentication provider. Sign out is available here and in the app shell.</p>
              <SignOutButton />
            </div>
          </Card>
        </section>
      ) : (
        <Card><p className="text-sm text-muted">No profile is available until your user is linked to a workspace.</p></Card>
      )}
    </AppShell>
  );
}
