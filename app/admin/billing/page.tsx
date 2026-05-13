import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getWorkspaceRows } from "@/lib/services/platform-admin-data";

export default async function AdminBillingPage() {
  const workspaces = await getWorkspaceRows();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="BILLING" title="Plan and usage control" description="Non-payment metadata only. Card, bank, payment secrets, and private client data are not stored or shown here." />
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
              <tr><th className="p-3">Workspace</th><th className="p-3">Plan</th><th className="p-3">Usage counts</th><th className="p-3">Billing status</th><th className="p-3">Action</th></tr>
            </thead>
            <tbody>
              {workspaces.map((workspace) => (
                <tr key={workspace.id} className="border-t border-white/5">
                  <td className="p-3">{workspace.name}</td>
                  <td className="p-3"><StatusPill tone="info">{workspace.plan}</StatusPill></td>
                  <td className="p-3">{workspace.counts.users} users · {workspace.counts.matters} matters · {workspace.counts.documents} docs</td>
                  <td className="p-3"><StatusPill tone="neutral">not integrated</StatusPill></td>
                  <td className="p-3"><Link href={`/admin/workspaces/${workspace.id}` as any} className="text-violet-400">Change plan</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
