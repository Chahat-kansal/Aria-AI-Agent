import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentClientFolderActions } from "@/components/app/agent-client-folder-actions";
import { AppShell } from "@/components/app/app-shell";
import { FullDraftPrintButton } from "@/components/app/full-draft-print-button";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { GradientButton } from "@/components/ui/gradient-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";
import { getMatterDetailData } from "@/lib/data/workspace-repository";
import { getAgentClientFolderConfirmation, isAssignedAgentForPrivateFolder } from "@/lib/services/agent-client-folder";
import { buildFullApplicationDraftForMatter } from "@/lib/services/full-application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";

function markerTone(marker: string) {
  if (marker === "VERIFIED" || marker === "APPROVED_FOR_AI") return "success";
  if (marker === "CONFLICTING_EVIDENCE" || marker === "MISSING") return "danger";
  if (marker === "CLIENT_CONFIRMATION_REQUIRED" || marker === "AGENT_REVIEW_REQUIRED" || marker === "SOURCE_REQUIRED" || marker === "UNSAFE_TO_AUTOFILL" || marker === "MANUAL_REVIEW_REQUIRED") return "warning";
  return "info";
}

function markerLabel(marker: string) {
  if (marker === "OFFICIAL_FORM_ONLINE_ONLY") return "[OFFICIAL FORM / ONLINE ONLY]";
  return `[${marker.replaceAll("_", " ")}]`;
}

export default async function FullApplicationDraftPage({ params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Full Application Draft">
        <PageHeader title="Workspace setup required" description="Create or join a workspace to generate staff review application drafts." />
      </AppShell>
    );
  }

  const allowedMatter = await getMatterDetailData(context.workspace.id, params.matterId, context.user);
  if (!allowedMatter) notFound();

  const draft = await buildFullApplicationDraftForMatter(params.matterId, context.user);
  const folderConfirmation = await getAgentClientFolderConfirmation(params.matterId);
  const isAssignedAgentFolderUser = isAssignedAgentForPrivateFolder(context.user, allowedMatter);
  const requiredMissingCount = draft.documentMatrix.filter((item) => item.status === "REQUIRED" && !item.uploaded).length;
  const uploadedCount = draft.documentMatrix.filter((item) => item.uploaded).length;
  const approvedDocumentCount = draft.documentMatrix.filter((item) => item.approvedForAiWorkingCopy).length;
  const fieldCount = draft.sections.reduce((total, section) => total + section.fields.length, 0);
  const missingFieldCount = draft.sections.flatMap((section) => section.fields).filter((field) => field.markers.includes("MISSING")).length;
  const reviewFieldCount = draft.sections.flatMap((section) => section.fields).filter((field) =>
    field.markers.includes("CLIENT_CONFIRMATION_REQUIRED")
    || field.markers.includes("AGENT_REVIEW_REQUIRED")
    || field.markers.includes("MANUAL_REVIEW_REQUIRED")
    || field.markers.includes("UNSAFE_TO_AUTOFILL")
  ).length;

  return (
    <AppShell title="Full Application Draft">
      <div className="space-y-8 print:bg-white print:text-black">
        <PageHeader
          eyebrow="STAFF REVIEW APPLICATION DRAFT"
          title={draft.title}
          description={`${allowedMatter.client.firstName} ${allowedMatter.client.lastName} - ${allowedMatter.title}`}
          action={
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link href={`/app/matters/${params.matterId}/review` as any}>
                <SubtleButton>Review evidence</SubtleButton>
              </Link>
              <Link href={`/app/matters/${params.matterId}/draft` as any}>
                <SubtleButton>Open field draft</SubtleButton>
              </Link>
              <FullDraftPrintButton />
            </div>
          }
        />

        <SectionCard className="overflow-hidden p-0 print:border print:border-slate-300 print:bg-white print:shadow-none">
          <div className="space-y-5 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_35%),linear-gradient(135deg,rgba(124,58,237,0.10),rgba(255,255,255,0))] p-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.18),transparent_35%),linear-gradient(135deg,rgba(124,58,237,0.16),rgba(3,7,18,0))] print:bg-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Record of responses draft</p>
              <h2 className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)]">Draft cover / masthead</h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-[color:var(--text-secondary)]">{draft.disclaimer}</p>
            </div>
            <div className="flex max-w-md flex-wrap gap-2 lg:justify-end">
              <StatusPill tone={draft.supportLevel === "FULL_STAFF_DRAFT" ? "success" : draft.supportLevel === "CHECKLIST_AND_INTAKE" ? "info" : "warning"}>
                {draft.supportLevel.replaceAll("_", " ")}
              </StatusPill>
              <StatusPill tone={draft.safety.status === "Ready for agent final review" ? "success" : "warning"}>
                {draft.safety.status}
              </StatusPill>
            </div>
          </div>
          {draft.supportNotes ? <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{draft.supportNotes}</p> : null}
          {!draft.canGenerate ? (
            <div className="rounded-2xl bg-amber-500/10 p-4 text-sm leading-6 text-amber-700 dark:text-amber-200">
              {draft.notEnoughEvidenceReason}
            </div>
          ) : null}
          <AIReviewNotice />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-[color:var(--surface)] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[color:var(--hairline)] print:border print:border-slate-200 print:bg-white print:shadow-none">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Document readiness</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{uploadedCount}/{draft.documentMatrix.length} uploaded, {approvedDocumentCount} approved</p>
            </div>
            <div className="rounded-2xl bg-[color:var(--surface)] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[color:var(--hairline)] print:border print:border-slate-200 print:bg-white print:shadow-none">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Missing pressure</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{requiredMissingCount} required docs, {missingFieldCount} draft fields</p>
            </div>
            <div className="rounded-2xl bg-[color:var(--surface)] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[color:var(--hairline)] print:border print:border-slate-200 print:bg-white print:shadow-none">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Review scope</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{reviewFieldCount} review markers across {fieldCount} fields</p>
            </div>
            <div className="rounded-2xl bg-[color:var(--surface)] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[color:var(--hairline)] print:border print:border-slate-200 print:bg-white print:shadow-none">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Safety position</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{draft.safety.status}</p>
            </div>
          </div>
          </div>
          <div className="grid gap-3 border-t border-[color:var(--hairline)] bg-[color:var(--surface)] p-6 md:grid-cols-2 xl:grid-cols-4 print:bg-white">
            {draft.cover.map((item) => (
              <div key={item.label} className="rounded-2xl bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[color:var(--hairline)] print:border print:border-slate-200 print:bg-white print:shadow-none">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{item.value || "Not set"}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <PageSection title="Staff action flags" description="Hard blockers, soft blockers, missing evidence, confirmations, conflicts, and next actions.">
          <SectionCard className="print:border print:border-slate-300 print:bg-white print:shadow-none">
            {draft.actionFlags.length ? draft.actionFlags.slice(0, 18).map((flag) => (
              <div key={`${flag.title}-${flag.detail}`} className="mb-3 rounded-2xl bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-sm)] ring-1 ring-[color:var(--hairline)] last:mb-0 print:border print:border-slate-200 print:bg-white">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={flag.severity === "hard" ? "danger" : flag.severity === "soft" ? "warning" : "info"}>{flag.severity}</StatusPill>
                  <p className="font-semibold text-[color:var(--text-primary)]">{flag.title}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">{flag.detail}</p>
              </div>
            )) : (
              <p className="text-sm text-[color:var(--text-secondary)]">No action flags detected. Registered migration agent review is still required.</p>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Required document matrix" description="Required, recommended, and conditional evidence for this subclass. These are workflow labels, not a statement of legal sufficiency.">
          <SectionCard className="overflow-hidden p-0 print:border print:border-slate-300 print:bg-white print:shadow-none">
            <div className="divide-y divide-[color:var(--hairline)]">
              {draft.documentMatrix.map((item) => (
                <div key={item.key} className="grid gap-4 p-5 transition hover:bg-[color:var(--surface-soft)] lg:grid-cols-[1.15fr_1.15fr_minmax(180px,0.8fr)] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={item.status === "REQUIRED" ? "danger" : item.status === "CONDITIONAL" ? "warning" : "info"}>{item.status}</StatusPill>
                      <p className="font-semibold text-[color:var(--text-primary)]">{item.label}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{item.description || item.category}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone={item.uploaded ? "success" : "warning"}>{item.uploaded ? "Uploaded" : "Missing"}</StatusPill>
                    <StatusPill tone={item.extracted ? "success" : "info"}>{item.extracted ? "Extracted" : "Not extracted"}</StatusPill>
                    <StatusPill tone={item.approvedForAiWorkingCopy ? "success" : "warning"}>{item.approvedForAiWorkingCopy ? "Approved for AI Working Copy" : "Review required"}</StatusPill>
                    {item.clientConfirmationRequired ? <StatusPill tone="warning">Client confirmation required</StatusPill> : null}
                  </div>
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    {item.matchedDocuments.length ? item.matchedDocuments.map((document) => document.fileName).join(", ") : "No linked file"}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </PageSection>

        {draft.sections.map((section) => (
          <PageSection key={section.key} title={section.title} description={section.description}>
            <SectionCard className="space-y-3 print:border print:border-slate-300 print:bg-white print:shadow-none">
              <div className="space-y-3">
                {section.fields.map((field) => (
                  <div key={field.key} className="grid gap-4 rounded-2xl bg-[color:var(--surface-soft)] p-4 ring-1 ring-[color:var(--hairline)] xl:grid-cols-[260px_minmax(0,1fr)_280px] print:border print:border-slate-200 print:bg-white">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{field.key}</p>
                      <p className="mt-2 font-semibold text-[color:var(--text-primary)]">{field.label}</p>
                    </div>
                    <div>
                      <p className="whitespace-pre-wrap rounded-2xl bg-[color:var(--surface)] p-4 text-sm leading-6 text-[color:var(--text-primary)] shadow-[var(--shadow-sm)] print:border print:border-slate-200 print:bg-white">
                        {field.value}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {field.markers.map((marker) => (
                          <StatusPill key={`${field.key}-${marker}`} tone={markerTone(marker) as any}>{markerLabel(marker)}</StatusPill>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-[color:var(--text-secondary)]">
                      <p><span className="font-medium text-[color:var(--text-primary)]">Source type:</span> {field.sourceType}</p>
                      <p><span className="font-medium text-[color:var(--text-primary)]">Source document:</span> {field.sourceDocument || "No approved source document"}</p>
                      <p><span className="font-medium text-[color:var(--text-primary)]">Reference:</span> {field.sourceReference || "No approved snippet/reference"}</p>
                      <p><span className="font-medium text-[color:var(--text-primary)]">Confidence:</span> {field.confidence == null ? "Not available" : `${Math.round(field.confidence * 100)}%`}</p>
                      <p><span className="font-medium text-[color:var(--text-primary)]">Status:</span> {field.status.replaceAll("_", " ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </PageSection>
        ))}

        <PageSection title="Safety / blocker assessment" description="Aria can prepare a staff review draft, but it does not lodge applications or provide final legal advice.">
          <SectionCard className="space-y-5 print:border print:border-slate-300 print:bg-white print:shadow-none">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={draft.supportLevel === "FULL_STAFF_DRAFT" ? "success" : draft.supportLevel === "CHECKLIST_AND_INTAKE" ? "info" : "warning"}>{draft.supportLevel.replaceAll("_", " ")}</StatusPill>
              <StatusPill tone={draft.safety.status === "Ready for agent final review" ? "success" : "warning"}>{draft.safety.status}</StatusPill>
              <StatusPill tone="danger">{draft.safety.hardBlockers.length} hard blocker(s)</StatusPill>
              <StatusPill tone="warning">{draft.safety.softBlockers.length} soft blocker(s)</StatusPill>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <p className="font-semibold text-[color:var(--text-primary)]">Hard blockers</p>
                <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-secondary)]">
                  {draft.safety.hardBlockers.length ? draft.safety.hardBlockers.map((item) => <li key={item}>{item}</li>) : <li>No hard blockers recorded. Agent review still required.</li>}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[color:var(--text-primary)]">Soft blockers</p>
                <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-secondary)]">
                  {draft.safety.softBlockers.length ? draft.safety.softBlockers.map((item) => <li key={item}>{item}</li>) : <li>No soft blockers recorded.</li>}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[color:var(--text-primary)]">Recommended next actions</p>
                <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-secondary)]">
                  {draft.safety.recommendedActions.length ? draft.safety.recommendedActions.map((item) => <li key={item}>{item}</li>) : <li>Run final cross-check after evidence and confirmations are reviewed.</li>}
                </ul>
              </div>
            </div>
          </SectionCard>
        </PageSection>

        <PageSection
          title="Assigned agent private folder"
          description="A client-named folder can be revealed only after the assigned agent confirms it. Aria generates the archive through a private route instead of exposing a raw storage link."
        >
          <SectionCard className="print:hidden">
            <AgentClientFolderActions
              matterId={params.matterId}
              isAssignedAgent={isAssignedAgentFolderUser}
              confirmed={Boolean(folderConfirmation)}
              confirmedBy={folderConfirmation?.actorUser?.name ?? folderConfirmation?.actorUser?.email ?? null}
              confirmedAt={folderConfirmation?.createdAt.toLocaleString("en-AU") ?? null}
            />
          </SectionCard>
        </PageSection>

        <div className="flex flex-wrap gap-3 print:hidden">
          <Link href={`/app/matters/${params.matterId}/draft` as any}>
            <GradientButton>Review field-level draft</GradientButton>
          </Link>
          <Link href={`/app/matters/${params.matterId}/review` as any}>
            <SubtleButton>Resolve missing evidence</SubtleButton>
          </Link>
          <FullDraftPrintButton />
        </div>
      </div>
    </AppShell>
  );
}
