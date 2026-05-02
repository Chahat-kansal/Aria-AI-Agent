import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { DraftFieldReviewControls, DraftWorkflowActions } from "@/components/app/draft-workflow-actions";
import { AIInsightPanel } from "@/components/ui/ai-insight-panel";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { createOrGetSubclass500Draft, getDraftReviewData } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getMatterDetailData } from "@/lib/data/workspace-repository";
import { hasPermission } from "@/lib/services/roles";

export default async function Subclass500DraftPage({ params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Forms & Field Review">
        <div className="space-y-6">
          <PageHeader title="Workspace setup required" description="Create or join a workspace to review draft applications." />
        </div>
      </AppShell>
    );
  }

  const allowedMatter = await getMatterDetailData(context.workspace.id, params.matterId, context.user);
  if (!allowedMatter) notFound();

  const canEditMatter = hasPermission(context.user, "can_edit_matters");
  const canUseAi = hasPermission(context.user, "can_access_ai");
  const canRunCrossCheck = hasPermission(context.user, "can_run_cross_check");

  await createOrGetSubclass500Draft(params.matterId);
  const { matter, template, draft, packageFolders, openIssues } = await getDraftReviewData(params.matterId);
  const sections = template.sections;
  const needsReviewCount = draft.fields.filter((field: any) => field.status === "NEEDS_REVIEW").length;
  const verifiedCount = draft.fields.filter((field: any) => field.status === "VERIFIED").length;
  const conflictingCount = draft.fields.filter((field: any) => field.status === "CONFLICTING").length;

  return (
    <AppShell title="Forms & Field Review">
      <div className="space-y-8">
        <PageHeader
          eyebrow="DRAFT REVIEW"
          title={`${template.name} draft`}
          description={`${matter.client.firstName} ${matter.client.lastName} · ${matter.title}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info">Subclass {template.subclassCode}</StatusPill>
              <StatusPill>{template.stream}</StatusPill>
              <StatusPill tone={draft.readinessScore >= 85 ? "success" : draft.readinessScore >= 65 ? "warning" : "danger"}>
                {draft.readinessScore}% ready
              </StatusPill>
            </div>
          }
        />

        <AIInsightPanel
          eyebrow="Aria review guidance"
          title="Source-linked draft review remains required"
          summary={`Aria is keeping this draft in an assisted state with ${openIssues.length} open validation issue${openIssues.length === 1 ? "" : "s"} and ${needsReviewCount} field${needsReviewCount === 1 ? "" : "s"} needing review. Every mapped value still requires registered migration agent verification before client confirmation or submission preparation.`}
          statusLabel="Review required"
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Readiness" value={`${draft.readinessScore}%`} hint="Current draft readiness score." accent={draft.readinessScore >= 85 ? "emerald" : draft.readinessScore >= 65 ? "amber" : "red"} />
          <MetricCard label="Verified fields" value={verifiedCount} hint="Fields already confirmed by review." accent="emerald" />
          <MetricCard label="Needs review" value={needsReviewCount} hint="Fields waiting for agent review." accent={needsReviewCount ? "amber" : "emerald"} />
          <MetricCard label="Conflicts" value={conflictingCount} hint="Fields with contradictory or weak evidence." accent={conflictingCount ? "red" : "emerald"} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="space-y-6">
            {sections.map((section: any) => {
              const fields = draft.fields.filter((field: any) => field.templateField.sectionId === section.id);
              return (
                <PageSection key={section.id} title={section.title} description="Review values, source snippets, evidence links, and confidence before confirming the field state.">
                  <div className="grid gap-4">
                    {fields.map((field: any) => {
                      const source = field.evidenceLinks[0];
                      const fieldStatusTone =
                        field.status === "VERIFIED"
                          ? "success"
                          : field.status === "CONFLICTING"
                            ? "danger"
                            : "warning";

                      return (
                        <SectionCard key={field.id} className="space-y-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-3xl">
                              <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">{field.templateField.fieldKey}</p>
                              <h3 className="mt-2 text-lg font-semibold text-white">{field.templateField.label}</h3>
                              <p className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-slate-200">
                                {field.manualOverride || field.value || "Missing"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 lg:max-w-xs lg:justify-end">
                              <StatusPill tone={fieldStatusTone as any}>{field.status.replaceAll("_", " ")}</StatusPill>
                              <StatusPill tone="info">
                                {field.confidence == null ? "No confidence" : `${Math.round(field.confidence * 100)}% confidence`}
                              </StatusPill>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Source document</p>
                              <p className="mt-2 text-sm text-slate-200">{source?.document.fileName ?? "No linked source yet"}</p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Location</p>
                              <p className="mt-2 text-sm text-slate-200">{field.sourcePageRef ?? "No location recorded"}</p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Evidence link</p>
                              <p className="mt-2 text-sm text-slate-200">{source ? "Linked to uploaded evidence" : "No evidence link yet"}</p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Source snippet</p>
                            <p className="mt-3 text-sm leading-7 text-slate-300">
                              {field.sourceSnippet ? `"${field.sourceSnippet}"` : "No source snippet is stored for this field yet."}
                            </p>
                          </div>

                          {canEditMatter ? <DraftFieldReviewControls draftFieldId={field.id} /> : null}
                        </SectionCard>
                      );
                    })}
                  </div>
                </PageSection>
              );
            })}
          </div>

          <div className="space-y-6">
            <PageSection title="Workflow actions">
              <SectionCard>
                <DraftWorkflowActions
                  matterId={matter.id}
                  draftId={draft.id}
                  canEditMatter={canEditMatter}
                  canUseAi={canUseAi}
                  canRunCrossCheck={canRunCrossCheck}
                />
              </SectionCard>
            </PageSection>

            <PageSection title="Validation issues">
              <SectionCard className="space-y-3">
                {openIssues.length ? openIssues.slice(0, 8).map((issue: any) => (
                  <div key={issue.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-sm font-medium text-white">{issue.title}</p>
                    <p className="mt-1 text-xs leading-6 text-slate-400">{issue.description}</p>
                  </div>
                )) : <p className="text-sm text-slate-400">No open Subclass 500 validation issues. Agent review is still required.</p>}
              </SectionCard>
            </PageSection>

            <PageSection title="Evidence package">
              <SectionCard className="space-y-3">
                {packageFolders.map((folder: any) => (
                  <div key={folder.folder} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{folder.folder}</p>
                      <StatusPill tone={folder.required && folder.documents.length === 0 ? "warning" : "info"}>
                        {folder.documents.length} file{folder.documents.length === 1 ? "" : "s"}
                      </StatusPill>
                    </div>
                    {folder.required && folder.documents.length === 0 ? <p className="mt-2 text-xs text-amber-300">Required evidence missing</p> : null}
                    <ul className="mt-2 space-y-1 text-xs text-slate-400">
                      {folder.documents.length ? folder.documents.map((document: any) => <li key={document.id}>{document.fileName}</li>) : <li>No linked file yet.</li>}
                    </ul>
                  </div>
                ))}
              </SectionCard>
            </PageSection>

            <PageSection title="Client review state">
              <SectionCard className="space-y-3">
                {draft.reviewRequests.length ? draft.reviewRequests.map((request: any) => (
                  request.publicToken ? (
                    <Link key={request.id} href={`/client-review/${request.publicToken}`} className="block rounded-2xl border border-white/8 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]">
                      <p className="text-sm font-medium text-white">{request.recipientEmail ?? "Client review link"}</p>
                      <p className="mt-1 text-xs text-slate-400">{request.status.replaceAll("_", " ").toLowerCase()}</p>
                    </Link>
                  ) : (
                    <div key={request.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-sm font-medium text-white">{request.recipientEmail ?? "Legacy review request"}</p>
                      <p className="mt-1 text-xs text-slate-400">{request.status.replaceAll("_", " ").toLowerCase()}</p>
                      <p className="mt-2 text-xs text-amber-300">Secure client link unavailable for this older request. Send a fresh request to generate a scoped review link.</p>
                    </div>
                  )
                )) : <p className="text-sm text-slate-400">No client review request has been sent yet.</p>}
              </SectionCard>
            </PageSection>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
