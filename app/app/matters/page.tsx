import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { CreateMatterForm } from "@/components/app/create-matter-form";
import { DataTable, DataTableCell, DataTableHeading, DataTableHeader, DataTableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getMattersData } from "@/lib/data/workspace-repository";
import { getVisaSubclassOptions } from "@/lib/services/visa-knowledge";
import { hasPermission } from "@/lib/services/roles";

export default async function MattersPage() {
  const context = await getCurrentWorkspaceContext();
  const matters = context ? await getMattersData(context.workspace.id, context.user) : [];
  const visaOptions = await getVisaSubclassOptions();
  const canEditMatter = context ? hasPermission(context.user, "can_edit_matters") : false;
  const lowReadinessCount = matters.filter((matter) => matter.readinessScore < 70).length;
  const openReviewCount = matters.reduce((count, matter) => count + matter._count.validationIssues, 0);
  const assignedCount = matters.filter((matter) => matter.assignedToUserId === context?.user.id).length;

  return (
    <AppShell title="Matters">
      <div className="space-y-8">
        <PageHeader
          eyebrow="MATTERS"
          title="All matters"
          description="Track real client files across readiness, stage, ownership, and review activity without leaving the workspace scope."
          action={<StatusPill tone="info">{context ? "Workspace scoped" : "Sign in required"}</StatusPill>}
        />

        {matters.length ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Visible matters" value={matters.length} hint="Respecting assignment and workspace visibility." accent="cyan" />
            <MetricCard label="Needs attention" value={lowReadinessCount} hint="Matters below 70% readiness." accent={lowReadinessCount ? "amber" : "emerald"} />
            <MetricCard label="Open review issues" value={openReviewCount} hint="Linked validation issues across visible matters." accent={openReviewCount ? "red" : "emerald"} />
            <MetricCard label="Assigned to you" value={assignedCount} hint="Current personal workload across visible files." accent="violet" />
          </section>
        ) : null}

        {canEditMatter ? (
          <PageSection eyebrow="NEW MATTER" title="Create a matter" description="Open a real client matter, choose the live visa workflow, and start the evidence review trail.">
            <SectionCard>
              <CreateMatterForm visaOptions={visaOptions} />
            </SectionCard>
          </PageSection>
        ) : (
          <SectionCard>
            <p className="text-sm leading-6 text-slate-300">You can view assigned matter records, but you do not have permission to create or edit matters.</p>
          </SectionCard>
        )}

        <PageSection title="Matter register" description="Every row here is live workspace data. Open a file to continue draft review, document intake, or checklist work.">
          {matters.length ? (
            <>
              <DataTable className="hidden lg:block">
                <table className="w-full text-sm">
                  <DataTableHeader>
                    <tr>
                      <DataTableHeading>Client</DataTableHeading>
                      <DataTableHeading>Reference</DataTableHeading>
                      <DataTableHeading>Matter</DataTableHeading>
                      <DataTableHeading className="text-center">Subclass</DataTableHeading>
                      <DataTableHeading className="text-center">Stage</DataTableHeading>
                      <DataTableHeading className="text-center">Assigned</DataTableHeading>
                      <DataTableHeading className="text-center">Readiness</DataTableHeading>
                      <DataTableHeading className="text-center">Updated</DataTableHeading>
                    </tr>
                  </DataTableHeader>
                  <tbody>
                    {matters.map((matter) => (
                      <DataTableRow key={matter.id}>
                        <DataTableCell>
                          <Link href={`/app/matters/${matter.id}`} className="font-medium text-cyan-300 transition hover:text-white">
                            {matter.client.firstName} {matter.client.lastName}
                          </Link>
                        </DataTableCell>
                        <DataTableCell>{matter.matterReference ?? matter.id.slice(0, 8)}</DataTableCell>
                        <DataTableCell>
                          <p className="font-medium text-white">{matter.title}</p>
                          <p className="text-xs text-slate-500">{matter.visaStream}</p>
                        </DataTableCell>
                        <DataTableCell className="text-center">{matter.visaSubclass}</DataTableCell>
                        <DataTableCell className="text-center"><StatusPill>{formatEnum(matter.stage)}</StatusPill></DataTableCell>
                        <DataTableCell className="text-center">{matter.assignedToUser.name ?? matter.assignedToUser.email}</DataTableCell>
                        <DataTableCell className="text-center">
                          <span className="font-medium text-white">{matter.readinessScore}%</span>
                        </DataTableCell>
                        <DataTableCell className="text-center text-slate-400">{formatDate(matter.updatedAt)}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </tbody>
                </table>
              </DataTable>

              <div className="grid gap-4 lg:hidden">
                {matters.map((matter) => (
                  <SectionCard key={matter.id} className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">{matter.matterReference ?? matter.id.slice(0, 8)}</p>
                        <Link href={`/app/matters/${matter.id}`} className="mt-2 block text-lg font-semibold text-white">
                          {matter.client.firstName} {matter.client.lastName}
                        </Link>
                        <p className="mt-1 text-sm text-slate-400">{matter.title}</p>
                      </div>
                      <StatusPill tone={matter.readinessScore >= 80 ? "success" : matter.readinessScore >= 60 ? "warning" : "danger"}>
                        {matter.readinessScore}%
                      </StatusPill>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Subclass</p>
                        <p className="mt-2 text-sm text-slate-200">{matter.visaSubclass} · {matter.visaStream}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Assigned</p>
                        <p className="mt-2 text-sm text-slate-200">{matter.assignedToUser.name ?? matter.assignedToUser.email}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Stage</p>
                        <div className="mt-2"><StatusPill>{formatEnum(matter.stage)}</StatusPill></div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Updated</p>
                        <p className="mt-2 text-sm text-slate-200">{formatDate(matter.updatedAt)}</p>
                      </div>
                    </div>
                  </SectionCard>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No matters yet"
              description="Once a matter is created, it will appear here with live readiness, ownership, and review state."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}
