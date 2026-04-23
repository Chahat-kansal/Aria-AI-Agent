import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { CreateMatterForm } from "@/components/app/create-matter-form";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatEnum, getMattersData } from "@/lib/data/workspace-repository";
import { getVisaSubclassOptions } from "@/lib/services/visa-knowledge";
import { hasPermission } from "@/lib/services/roles";

export default async function MattersPage() {
  const context = await getCurrentWorkspaceContext();
  const matters = context ? await getMattersData(context.workspace.id, context.user) : [];
  const visaOptions = await getVisaSubclassOptions();
  const canEditMatter = context ? hasPermission(context.user, "can_edit_matters") : false;

  return (
    <AppShell title="Matters">
      <PageHeader title="Matter Register" subtitle="Track status, stage, ownership, and submission readiness across all active files." />
      {canEditMatter ? <Card className="mb-4">
        <h3 className="font-semibold">Create matter</h3>
        <p className="mb-3 mt-1 text-sm text-muted">Create a real client matter, select the application workflow, then upload evidence for AI-assisted review.</p>
        <CreateMatterForm visaOptions={visaOptions} />
      </Card> : <Card className="mb-4"><p className="text-sm text-muted">You can view assigned matter records, but you do not have permission to create or edit matters.</p></Card>}
      <div className="panel overflow-hidden">
        {matters.length ? (
          <table className="w-full text-sm">
            <thead className="bg-white/70 text-muted">
              <tr><th className="p-3 text-left">Client</th><th className="p-3 text-left">Reference</th><th className="p-3 text-left">Matter</th><th className="p-3">Subclass</th><th className="p-3">Stream</th><th className="p-3">Owner</th><th className="p-3">Stage</th><th className="p-3">Readiness</th></tr>
            </thead>
            <tbody>
              {matters.map((matter) => (
                <tr key={matter.id} className="border-t border-border hover:bg-white/65">
                  <td className="p-3"><Link href={`/app/matters/${matter.id}`} className="text-accent">{matter.client.firstName} {matter.client.lastName}</Link></td>
                  <td className="p-3 text-muted">{matter.matterReference ?? matter.id.slice(0, 8)}</td>
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
