import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatEnum, getMattersData } from "@/lib/data/workspace-repository";

export default async function MattersPage() {
  const context = await getCurrentWorkspaceContext();
  const matters = context ? await getMattersData(context.workspace.id) : [];

  return (
    <AppShell title="Matters">
      <PageHeader title="Matter Register" subtitle="Track status, stage, ownership, and submission readiness across all active files." />
      <div className="panel overflow-hidden">
        {matters.length ? (
          <table className="w-full text-sm">
            <thead className="bg-[#101a2e] text-muted">
              <tr><th className="p-3 text-left">Client</th><th className="p-3 text-left">Matter</th><th className="p-3">Subclass</th><th className="p-3">Stream</th><th className="p-3">Owner</th><th className="p-3">Stage</th><th className="p-3">Readiness</th></tr>
            </thead>
            <tbody>
              {matters.map((matter) => (
                <tr key={matter.id} className="border-t border-border hover:bg-[#0f1727]">
                  <td className="p-3"><Link href={`/app/matters/${matter.id}`} className="text-accent">{matter.client.firstName} {matter.client.lastName}</Link></td>
                  <td className="p-3">{matter.title}</td>
                  <td className="p-3 text-center">{matter.visaSubclass}</td>
                  <td className="p-3 text-center">{matter.visaStream}</td>
                  <td className="p-3 text-center">{matter.assignedToUser.name}</td>
                  <td className="p-3 text-center">{formatEnum(matter.stage)}</td>
                  <td className="p-3 text-center">{matter.readinessScore}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-muted">No matters are stored for this workspace yet. Once a matter is created, it will appear here with live readiness, owner, and review state.</p>
        )}
      </div>
    </AppShell>
  );
}
