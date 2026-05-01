import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { GradientButton } from "@/components/ui/gradient-button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";
import { prisma } from "@/lib/prisma";
import { generateChecklistForMatter } from "@/lib/services/client-workflows";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";

export default async function MatterChecklistPage({ params }: { params: { matterId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  const matter = await prisma.matter.findFirst({
    where: { id: params.matterId, workspaceId: context.workspace.id },
    include: { assignedToUser: true, client: true, checklistItems: { include: { document: true }, orderBy: { label: "asc" } } }
  });

  if (!matter || !canAccessMatter(context.user, matter)) notFound();

  async function handleGenerate() {
    "use server";
    await generateChecklistForMatter(params.matterId, context.user.id);
    revalidatePath(`/app/matters/${params.matterId}/checklist`);
    revalidatePath(`/app/matters/${params.matterId}`);
  }

  const requiredItems = matter.checklistItems.filter((item) => item.required);
  const optionalItems = matter.checklistItems.filter((item) => !item.required);
  const linkedCount = matter.checklistItems.filter((item) => item.documentId).length;
  const completedCount = matter.checklistItems.filter((item) => item.status === "RECEIVED" || item.status === "REVIEWED").length;

  return (
    <AppShell title="Matters">
      <div className="space-y-8">
        <PageHeader
          eyebrow="CHECKLIST"
          title={`${matter.client.firstName} ${matter.client.lastName}`}
          description="Real visa checklist records linked to this matter, uploaded evidence, and client request workflows."
          action={
            hasPermission(context.user, "can_edit_matters") ? (
              <form action={handleGenerate}>
                <GradientButton type="submit">
                  {matter.checklistItems.length ? "Regenerate checklist" : "Generate checklist"}
                </GradientButton>
              </form>
            ) : null
          }
        />

        {matter.checklistItems.length ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Checklist items" value={matter.checklistItems.length} hint="Real items stored for this matter." accent="cyan" />
            <MetricCard label="Required" value={requiredItems.length} hint="Items required before submission readiness." accent="violet" />
            <MetricCard label="Linked documents" value={linkedCount} hint="Items already tied to uploaded evidence." accent={linkedCount ? "emerald" : "amber"} />
            <MetricCard label="Received / reviewed" value={completedCount} hint="Items already progressed beyond missing state." accent={completedCount ? "emerald" : "amber"} />
          </section>
        ) : null}

        {matter.checklistItems.length ? (
          <section className="grid gap-6 xl:grid-cols-2">
            <PageSection title="Required evidence" description="These items should be resolved before the matter can move cleanly through final review.">
              <div className="grid gap-4">
                {requiredItems.map((item) => (
                  <SectionCard key={item.id} className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-300">{item.category}</p>
                        {item.description ? <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone="warning">Required</StatusPill>
                        <StatusPill tone={item.document ? "success" : "danger"}>{item.status}</StatusPill>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Linked document</p>
                        <p className="mt-2 text-sm text-slate-200">{item.document?.fileName ?? "No document linked yet"}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Due date</p>
                        <p className="mt-2 text-sm text-slate-200">{item.dueDate ? item.dueDate.toLocaleDateString("en-AU") : "Not set"}</p>
                      </div>
                    </div>
                  </SectionCard>
                ))}
              </div>
            </PageSection>

            <PageSection title="Optional evidence" description="Useful supporting material that still strengthens the matter if available.">
              <div className="grid gap-4">
                {optionalItems.length ? optionalItems.map((item) => (
                  <SectionCard key={item.id} className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-300">{item.category}</p>
                        {item.description ? <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill>Optional</StatusPill>
                        <StatusPill tone={item.document ? "success" : "info"}>{item.status}</StatusPill>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Linked document</p>
                      <p className="mt-2 text-sm text-slate-200">{item.document?.fileName ?? "No document linked yet"}</p>
                    </div>
                  </SectionCard>
                )) : <SectionCard><p className="text-sm text-slate-400">No optional checklist items are recorded for this matter.</p></SectionCard>}
              </div>
            </PageSection>
          </section>
        ) : (
          <EmptyState
            title="No checklist items yet"
            description="Generate the real checklist for this visa matter to start requesting documents and linking evidence."
          />
        )}

        <PageSection title="Next actions">
          <div className="flex flex-wrap gap-3">
            <Link href="/app/document-requests"><SubtleButton>Open document requests</SubtleButton></Link>
            <Link href={`/app/matters/${matter.id}/draft`}><SubtleButton>Open draft review</SubtleButton></Link>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
