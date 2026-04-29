import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { DraftFieldReviewControls, DraftWorkflowActions } from "@/components/app/draft-workflow-actions";
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
          <p className="mt-3 text-sm text-muted">
            Fields below are draft values only. Each item remains reviewable and must be verified by a registered migration agent before client confirmation or submission preparation.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold">Workflow actions</h3>
          <div className="mt-3">
            <DraftWorkflowActions matterId={matter.id} draftId={draft.id} canEditMatter={canEditMatter} canUseAi={canUseAi} canRunCrossCheck={canRunCrossCheck} />
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {sections.map((section: any) => {
            const fields = draft.fields.filter((field: any) => field.templateField.sectionId === section.id);
            return (
              <Card key={section.id}>
                <h3 className="font-semibold">{section.title}</h3>
                <div className="mt-3 space-y-3">
                  {fields.map((field: any) => {
                    const source = field.evidenceLinks[0];
                    return (
                      <div key={field.id} className="rounded-xl border border-border bg-white/55 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted">{field.templateField.fieldKey}</p>
                            <p className="font-medium">{field.templateField.label}</p>
                            <p className="mt-1 text-sm">{field.manualOverride || field.value || "Missing"}</p>
                            <p className="mt-2 text-xs text-muted">Source: {source?.document.fileName ?? "No linked source yet"} - {field.sourcePageRef ?? "No location"}</p>
                            <p className="mt-1 text-xs text-muted">Snippet: {field.sourceSnippet ? `"${field.sourceSnippet}"` : "No source snippet yet"}</p>
                          </div>
                          <div className="min-w-36 text-right text-xs">
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
            <h3 className="font-semibold">Subclass 500 validation</h3>
            {openIssues.length ? (
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {openIssues.slice(0, 8).map((issue: any) => (
                  <li key={issue.id} className="rounded-lg border border-border p-2">
                    <span className="font-medium text-[#182033]">{issue.title}</span>
                    <p className="mt-1 text-xs">{issue.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No open Subclass 500 validation issues. Agent review is still required.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold">Evidence package</h3>
            <div className="mt-3 space-y-2">
              {packageFolders.map((folder: any) => (
                <div key={folder.folder} className="rounded-lg border border-border p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{folder.folder}</p>
                    <span className="text-xs text-muted">{folder.documents.length} file(s)</span>
                  </div>
                  {folder.required && folder.documents.length === 0 ? <p className="mt-1 text-xs text-warning">Required evidence missing</p> : null}
                  <ul className="mt-1 space-y-1 text-xs text-muted">
                    {folder.documents.map((document: any) => <li key={document.id}>{document.fileName}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold">Client review state</h3>
            {draft.reviewRequests.length ? (
              <div className="mt-3 space-y-2 text-sm text-muted">
                {draft.reviewRequests.map((request: any) => (
                  <Link key={request.id} href={`/client-review/${request.id}` as any} className="block rounded-lg border border-border p-2">
                    {request.status.replaceAll("_", " ").toLowerCase()} - {request.recipientEmail ?? "client"}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No client review request has been sent yet.</p>
            )}
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
