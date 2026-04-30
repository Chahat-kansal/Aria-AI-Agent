import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { TeamUserForm } from "@/components/app/team-user-form";
import { TeamUserActions } from "@/components/app/team-user-actions";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam, getUserPermissions, permissionDefinitions, roleDefinitions, roleDescription, roleLabel } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { generateSecurityIntelligence, generateTeamIntelligence } from "@/lib/services/aria-intelligence";

export default async function TeamPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Team">
        <div className="space-y-6">
          <PageHeader title="Team Management" description="Company staff access is controlled by owner and administrator permissions." />
          <Card>
            <h3 className="text-sm font-semibold text-slate-100">You do not have permission to manage team members</h3>
            <p className="mt-2 text-sm text-slate-300">Ask a Company Owner or Access Administrator to enable the Manage team permission for your account.</p>
          </Card>
        </div>
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
  const [teamIntelligence, securityIntelligence] = await Promise.all([
    generateTeamIntelligence(context.workspace.id, context.user),
    generateSecurityIntelligence(context.workspace.id, context.user)
  ]);

  return (
    <AppShell title="Team">
      <div className="space-y-6">
        <PageHeader
          title="Team Members"
          description="Create staff accounts, assign roles, enforce visibility scope, and manage activation for this migration company."
        />

        <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
          <Card>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-100">Team members</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Staff accounts are real login users inside this company workspace. Access is limited by role, visibility scope, and per-user feature permissions.
              </p>
            </div>
            <TeamUserForm roles={roleDefinitions} supervisors={users.map((user) => ({ id: user.id, name: user.name, email: user.email }))} permissions={permissionDefinitions} />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-100">Role guide</h3>
            <div className="mt-4 max-h-[560px] space-y-2 overflow-auto pr-1">
              {roleDefinitions.map((role) => (
                <div key={role.role} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-white">{role.label}</p>
                    <span className="text-xs text-slate-500">{role.category}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{role.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Card>
            <h3 className="text-sm font-semibold text-slate-100">Aria workload intelligence</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">AI-assisted workload view built from assigned matters, tasks, and review queues. Review required before reshuffling work.</p>
            <p className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-slate-300">{teamIntelligence.summary}</p>
            <div className="mt-4 space-y-2">
              {teamIntelligence.recommendedActions.length ? teamIntelligence.recommendedActions.map((action) => (
                <div key={`${action.entityId}-${action.title}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-white">{action.title}</p>
                    <StatusChip label={action.priority} />
                  </div>
                  <p className="mt-1 text-slate-400">{action.reason}</p>
                </div>
              )) : <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-400">No major workload bottleneck is visible right now.</p>}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-100">Aria security intelligence</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">Permission breadth, stale invites, and recent audit signals surfaced for owner/admin review.</p>
            <p className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-slate-300">{securityIntelligence.summary}</p>
            <div className="mt-4 space-y-2">
              {securityIntelligence.securityWarnings.length ? securityIntelligence.securityWarnings.map((warning) => (
                <div key={warning} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-300">{warning}</div>
              )) : <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-400">No major security warning is obvious from the recent audit trail.</p>}
            </div>
          </Card>
        </section>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45 backdrop-blur-xl">
          {users.length ? (
            <div className="divide-y divide-white/5">
              {users.map((user) => (
                <div key={user.id} className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr_1.2fr_auto] lg:items-start">
                  <div>
                    <p className="font-semibold text-white">{user.name}</p>
                    <p className="text-sm text-slate-400">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.jobTitle || roleLabel(user.role)}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <StatusChip label={roleLabel(user.role)} />
                    <p className="text-xs leading-5 text-slate-400">{roleDescription(user.role)}</p>
                  </div>
                  <div className="text-sm text-slate-400">
                    <p>Status: {user.status.toLowerCase()}</p>
                    {user.status === "INVITED" ? <p>Invite expires: {user.inviteExpiresAt ? user.inviteExpiresAt.toLocaleDateString("en-AU") : "Not set"}</p> : null}
                    <p>Scope: {user.visibilityScope.replaceAll("_", " ").toLowerCase()}</p>
                    <p>Supervisor: {user.supervisor?.name ?? "Not set"}</p>
                    <p>{user._count.mattersAssigned} matters · {user._count.clientsAssigned} clients · {user._count.tasksAssigned} tasks · {user._count.uploadedDocuments} uploads</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {permissionDefinitions.map((permission) => (
                        <span key={permission.key} className={`rounded-full border px-2 py-1 text-[11px] ${getUserPermissions(user)[permission.key] ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
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
            <div className="p-6 text-sm text-slate-400">No staff users exist yet. Create the first staff account above.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
