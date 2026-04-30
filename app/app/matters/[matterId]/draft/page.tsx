import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { DraftFieldReviewControls, DraftWorkflowActions } from "@/components/app/draft-workflow-actions";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { StatusPill } from "@/components/ui/status-pill";
import { createOrGetSubclass500Draft, getDraftReviewData } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getMatterDetailData } from "@/lib/data/workspace-repository";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/services/roles";

export default async function Subclass500DraftPage({ params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return <AppShell title="Forms & Field Review"><PageHeader title="Workspace setup required" subtitle="Create or join a workspace to review draft applications." /></AppShell>;
  const allowedMatter = await getMatterDetailData(context.workspace.id, params.matterId, context.user);
  if (!allowedMatter) notFound();
  const canEditMatter = hasPermission(context.user, "can_edit_matters");
  const canUseAi = hasPermission(context.user, "can_access_ai");
  const canRunCrossCheck = hasPermission(context.user, "can_run_cross_check");
  await createOrGetSubclass500Draft(params.matterId);
  const { matter, template, draft, packageFolders, openIssues } = await getDraftReviewData(params.matterId);
  const sections = template.sections;

  return (
    <AppShell title="Forms & Field Review">
      <PageHeader
        title={`${template.name} draft`}
        subtitle={`${matter.client.firstName} ${matter.client.lastName} - ${matter.title}. AI-assisted, source-linked, client review required before final submission preparation.`}
      />

      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-accent/40 bg-accent/10 text-accent">Subclass {template.subclassCode}</Badge>
            <Badge className="border-border bg-transparent">{template.stream}</Badge>
            <Badge className="border-border bg-transparent">Readiness {draft.readinessScore}%</Badge>
            <Badge className="border-border bg-transparent">{draft.status.replaceAll("_", " ").toLowerCase()}</Badge>
          </div>
          <p className="mt-3 text-sm text-slate-300">
            Fields below are draft values only. Each item remains reviewable and must be verified by a registered migration agent before client confirmation or submission preparation.
          </p>
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Workflow actions</h3>
          <div className="mt-3">
            <DraftWorkflowActions matterId={matter.id} draftId={draft.id} canEditMatter={canEditMatter} canUseAi={canUseAi} canRunCrossCheck={canRunCrossCheck} />
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <AIInsightCard
            summary={`Aria is keeping this draft in an assisted state with ${openIssues.length} open validation issue${openIssues.length === 1 ? "" : "s"}, readiness at ${draft.readinessScore}%, and review-required evidence links on each mapped field.`}
            actions={
              <>
                <StatusPill tone={draft.readinessScore >= 85 ? "success" : draft.readinessScore >= 65 ? "warning" : "danger"}>
                  {draft.readinessScore >= 85 ? "ready for review" : draft.readinessScore >= 65 ? "needs review" : "blocked"}
                </StatusPill>
              </>
            }
          />
          {sections.map((section: any) => {
            const fields = draft.fields.filter((field: any) => field.templateField.sectionId === section.id);
            return (
              <Card key={section.id}>
                <h3 className="text-xl font-semibold tracking-tight text-white">{section.title}</h3>
                <div className="mt-3 space-y-3">
                  {fields.map((field: any) => {
                    const source = field.evidenceLinks[0];
                    return (
                      <div key={field.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-400">{field.templateField.fieldKey}</p>
                            <p className="font-medium text-white">{field.templateField.label}</p>
                            <p className="mt-1 text-sm text-slate-200">{field.manualOverride || field.value || "Missing"}</p>
                            <p className="mt-2 text-xs text-slate-400">Source: {source?.document.fileName ?? "No linked source yet"} - {field.sourcePageRef ?? "No location"}</p>
                            <p className="mt-1 text-xs text-slate-400">Snippet: {field.sourceSnippet ? `"${field.sourceSnippet}"` : "No source snippet yet"}</p>
                          </div>
                          <div className="min-w-36 text-right text-xs text-slate-300">
                            <p className="mb-2">Confidence: {field.confidence == null ? "-" : `${Math.round(field.confidence * 100)}%`}</p>
                            <StatusChip label={field.status.replaceAll("_", " ").toLowerCase()} />
                            {canEditMatter ? <DraftFieldReviewControls draftFieldId={field.id} /> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Subclass 500 validation</h3>
            {openIssues.length ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {openIssues.slice(0, 8).map((issue: any) => (
                  <li key={issue.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <span className="font-medium text-white">{issue.title}</span>
                    <p className="mt-1 text-xs text-slate-400">{issue.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No open Subclass 500 validation issues. Agent review is still required.</p>
            )}
          </Card>

          <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Evidence package</h3>
            <div className="mt-3 space-y-2">
              {packageFolders.map((folder: any) => (
                <div key={folder.folder} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{folder.folder}</p>
                    <span className="text-xs text-slate-400">{folder.documents.length} file(s)</span>
                  </div>
                  {folder.required && folder.documents.length === 0 ? <p className="mt-1 text-xs text-amber-300">Required evidence missing</p> : null}
                  <ul className="mt-1 space-y-1 text-xs text-slate-400">
                    {folder.documents.map((document: any) => <li key={document.id}>{document.fileName}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Client review state</h3>
            {draft.reviewRequests.length ? (
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {draft.reviewRequests.map((request: any) => (
                  <Link key={request.id} href={`/client-review/${request.id}` as any} className="block rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.08]">
                    {request.status.replaceAll("_", " ").toLowerCase()} - {request.recipientEmail ?? "client"}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No client review request has been sent yet.</p>
            )}
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
