import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { TeamUserForm } from "@/components/app/team-user-form";
import { TeamUserActions } from "@/components/app/team-user-actions";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam, getUserPermissions, permissionDefinitions, roleDefinitions, roleDescription, roleLabel } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export default async function TeamPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Team">
        <PageHeader title="Team Management" subtitle="Company staff access is controlled by owner and administrator permissions." />
        <Card>
          <h3 className="font-semibold">You do not have permission to manage team members</h3>
          <p className="mt-2 text-sm text-muted">Ask a Company Owner or Access Administrator to enable the Manage team permission for your account.</p>
        </Card>
      </AppShell>
    );
  }

  const users = await prisma.user.findMany({
    where: { workspaceId: context.workspace.id },
    include: {
      supervisor: true,
      _count: { select: { mattersAssigned: true, tasksAssigned: true, uploadedDocuments: true, clientsAssigned: true } }
    },
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });

  return (
    <AppShell title="Team">
      <PageHeader title="Team Members" subtitle="Create staff accounts, assign roles, enforce visibility scope, and manage activation for this migration company." />
      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Team Members</h3>
              <p className="mt-1 text-sm text-muted">Staff accounts are real login users inside this company workspace. Access is limited by role, visibility scope, and per-user feature permissions.</p>
            </div>
          </div>
          <TeamUserForm roles={roleDefinitions} supervisors={users.map((user) => ({ id: user.id, name: user.name, email: user.email }))} permissions={permissionDefinitions} />
        </Card>
        <Card>
          <h3 className="font-semibold">Role guide</h3>
          <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-2">
            {roleDefinitions.map((role) => (
              <div key={role.role} className="rounded-lg border border-border bg-white/50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{role.label}</p>
                  <span className="text-xs text-muted">{role.category}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{role.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <div className="panel mt-4 overflow-hidden">
        {users.length ? (
          <div className="divide-y divide-border">
            {users.map((user) => (
              <div key={user.id} className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr_1.2fr_auto] lg:items-start">
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-muted">{user.email}</p>
                  <p className="mt-1 text-xs text-muted">{user.jobTitle || roleLabel(user.role)}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <StatusChip label={roleLabel(user.role)} />
                  <p className="text-xs text-muted">{roleDescription(user.role)}</p>
                </div>
                <div className="text-sm text-muted">
                  <p>Status: {user.status.toLowerCase()}</p>
                  {user.status === "INVITED" ? <p>Invite expires: {user.inviteExpiresAt ? user.inviteExpiresAt.toLocaleDateString("en-AU") : "Not set"}</p> : null}
                  <p>Scope: {user.visibilityScope.replaceAll("_", " ").toLowerCase()}</p>
                  <p>Supervisor: {user.supervisor?.name ?? "Not set"}</p>
                  <p>{user._count.mattersAssigned} matters - {user._count.clientsAssigned} clients - {user._count.tasksAssigned} tasks - {user._count.uploadedDocuments} uploads</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {permissionDefinitions.map((permission) => (
                      <span key={permission.key} className={`rounded-full border px-2 py-1 text-[11px] ${getUserPermissions(user)[permission.key] ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-white/50 text-muted"}`}>
                        {permission.label}: {getUserPermissions(user)[permission.key] ? "On" : "Off"}
                      </span>
                    ))}
                  </div>
                </div>
                <TeamUserActions
                  userId={user.id}
                  currentName={user.name}
                  currentRole={user.role}
                  currentJobTitle={user.jobTitle}
                  currentStatus={user.status}
                  isCompanyOwner={user.role === "COMPANY_OWNER"}
                  permissions={getUserPermissions(user)}
                  permissionDefinitions={permissionDefinitions}
                  roleDefinitions={roleDefinitions}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-muted">No staff users exist yet. Create the first staff account above.</p>
        )}
      </div>
    </AppShell>
  );
}
