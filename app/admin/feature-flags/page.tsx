import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getWorkspaceRows } from "@/lib/services/platform-admin-data";

export default async function AdminFeatureFlagsPage() {
  const workspaces = await getWorkspaceRows();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="FEATURE FLAGS" title="Workspace feature flags" description="Feature toggles are workspace-scoped. Secrets and private content are not visible." />
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
              <tr><th className="p-3">Workspace</th><th className="p-3">Portal</th><th className="p-3">AI Autofill</th><th className="p-3">PDF Filling</th><th className="p-3">Exports</th><th className="p-3">Action</th></tr>
            </thead>
            <tbody>
              {workspaces.map((workspace) => (
                <tr key={workspace.id} className="border-t border-white/5">
                  <td className="p-3">{workspace.name}</td>
                  <td className="p-3"><StatusPill tone={workspace.launch?.clientPortalEnabled ? "success" : "warning"}>{workspace.launch?.clientPortalEnabled ? "on" : "off"}</StatusPill></td>
                  <td className="p-3"><StatusPill tone={workspace.launch?.aiDraftAutofillEnabled ? "success" : "warning"}>{workspace.launch?.aiDraftAutofillEnabled ? "on" : "off"}</StatusPill></td>
                  <td className="p-3"><StatusPill tone={workspace.launch?.pdfFormFillingEnabled ? "success" : "warning"}>{workspace.launch?.pdfFormFillingEnabled ? "on" : "off"}</StatusPill></td>
                  <td className="p-3"><StatusPill tone={workspace.launch?.exportEnabled ? "success" : "warning"}>{workspace.launch?.exportEnabled ? "on" : "off"}</StatusPill></td>
                  <td className="p-3"><Link href={`/admin/workspaces/${workspace.id}` as any} className="text-violet-400">Manage</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
