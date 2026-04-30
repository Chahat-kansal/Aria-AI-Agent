import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { CreateMatterForm } from "@/components/app/create-matter-form";
import { EmptyState } from "@/components/ui/empty-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { StatusPill } from "@/components/ui/status-pill";
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
      {canEditMatter ? <Card className="mb-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">New matter</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Create a matter</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">Create a real client matter, select the application workflow, then upload evidence for AI-assisted review.</p>
          </div>
          <StatusPill tone="info">Workspace scoped</StatusPill>
        </div>
        <CreateMatterForm visaOptions={visaOptions} />
      </Card> : <Card className="mb-6"><p className="text-sm leading-6 text-slate-300">You can view assigned matter records, but you do not have permission to create or edit matters.</p></Card>}
      <div className="aria-table-wrap">
        {matters.length ? (
          <table className="w-full text-sm">
            <thead className="aria-table-head">
              <tr>
                <th className="aria-table-th">Client</th>
                <th className="aria-table-th">Reference</th>
                <th className="aria-table-th">Matter</th>
                <th className="aria-table-th text-center">Subclass</th>
                <th className="aria-table-th text-center">Stream</th>
                <th className="aria-table-th text-center">Owner</th>
                <th className="aria-table-th text-center">Stage</th>
                <th className="aria-table-th text-center">Readiness</th>
              </tr>
            </thead>
            <tbody>
              {matters.map((matter) => (
                <tr key={matter.id} className="aria-table-row">
                  <td className="aria-table-td">
                    <Link href={`/app/matters/${matter.id}` as any} className="font-medium text-cyan-300 transition hover:text-white">
                      {matter.client.firstName} {matter.client.lastName}
                    </Link>
                  </td>
                  <td className="aria-table-td text-slate-300">{matter.matterReference ?? matter.id.slice(0, 8)}</td>
                  <td className="aria-table-td text-white">{matter.title}</td>
                  <td className="aria-table-td text-center text-slate-300">{matter.visaSubclass}</td>
                  <td className="aria-table-td text-center text-slate-300">{matter.visaStream}</td>
                  <td className="aria-table-td text-center text-slate-300">{matter.assignedToUser.name}</td>
                  <td className="aria-table-td text-center"><StatusPill>{formatEnum(matter.stage)}</StatusPill></td>
                  <td className="aria-table-td text-center font-medium text-white">{matter.readinessScore}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="No matters yet"
            description="Once a matter is created, it will appear here with live readiness, ownership, and review state."
            action={canEditMatter ? <SecondaryButton>Create your first matter above</SecondaryButton> : undefined}
          />
        )}
      </div>
    </AppShell>
  );
}
