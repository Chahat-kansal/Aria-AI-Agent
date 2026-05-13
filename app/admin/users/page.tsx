import { UserRole, UserStatus } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin, auditPlatformAdminAction } from "@/lib/services/platform-admin";
import { getUserRows, formatDate } from "@/lib/services/platform-admin-data";
import { defaultPermissionsForRole } from "@/lib/services/roles";

async function updateUserAccess(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const userId = String(formData.get("userId") || "");
  const status = String(formData.get("status") || "ACTIVE") as UserStatus;
  const role = String(formData.get("role") || "MIGRATION_AGENT") as UserRole;
  await prisma.user.update({
    where: { id: userId },
    data: { status, role, permissionsJson: defaultPermissionsForRole(role) }
  });
  await auditPlatformAdminAction(admin.user, "platform.user.access_updated", { userId, status, role });
}

export default async function AdminUsersPage() {
  const users = await getUserRows();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="USERS" title="User management" description="Safe account metadata only. Password hashes, tokens, and private client content are never shown." />
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
              <tr><th className="p-3">User</th><th className="p-3">Workspace</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Activity</th><th className="p-3">Action</th></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/5">
                  <td className="p-3"><p className="font-medium">{user.name}</p><p className="text-xs text-[color:var(--text-tertiary)]">{user.email}</p></td>
                  <td className="p-3">{user.workspaceName}</td>
                  <td className="p-3"><StatusPill tone="info">{user.role}</StatusPill></td>
                  <td className="p-3"><StatusPill tone={user.status === "ACTIVE" ? "success" : "warning"}>{user.status}</StatusPill></td>
                  <td className="p-3 text-xs text-[color:var(--text-tertiary)]">Invite accepted: {formatDate(user.inviteAcceptedAt)}</td>
                  <td className="p-3">
                    <form action={updateUserAccess} className="flex flex-wrap gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <select name="status" defaultValue={user.status} className="rounded-xl bg-[color:var(--surface-soft)] px-2 py-1">
                        {Object.values(UserStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <select name="role" defaultValue={user.role} className="rounded-xl bg-[color:var(--surface-soft)] px-2 py-1">
                        {Object.values(UserRole).map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                      <button className="rounded-xl bg-violet-600 px-3 py-1 text-white">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

