import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getWorkspaceRows } from "@/lib/services/platform-admin-data";

export default async function AdminWorkspacesPage() {
  const workspaces = await getWorkspaceRows();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="WORKSPACES" title="Workspace management" description="Safe metadata only. Counts are shown without client names, matter titles, document names, or extracted content." />
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
              <tr><th className="p-3">Workspace</th><th className="p-3">Owner</th><th className="p-3">Plan</th><th className="p-3">Counts</th><th className="p-3">Launch</th><th className="p-3">Actions</th></tr>
            </thead>
            <tbody>
              {workspaces.map((workspace) => (
                <tr key={workspace.id} className="border-t border-white/5">
                  <td className="p-3"><p className="font-medium">{workspace.name}</p><p className="text-xs text-[color:var(--text-tertiary)]">{workspace.slug} · {workspace.id}</p></td>
                  <td className="p-3"><p>{workspace.ownerName}</p><p className="text-xs text-[color:var(--text-tertiary)]">{workspace.ownerEmail}</p></td>
                  <td className="p-3"><StatusPill tone="info">{workspace.plan}</StatusPill></td>
                  <td className="p-3 text-xs text-[color:var(--text-secondary)]">{workspace.counts.users} users · {workspace.counts.matters} matters · {workspace.counts.documents} docs</td>
                  <td className="p-3"><StatusPill tone={workspace.launch?.allowRealClientUploads ? "warning" : "neutral"}>{workspace.launch?.betaModeEnabled ? "beta" : "controlled"}</StatusPill></td>
                  <td className="p-3"><Link href={`/admin/workspaces/${workspace.id}` as any} className="text-violet-400">Manage metadata</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
