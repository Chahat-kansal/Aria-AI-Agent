import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ClientPortalLinkButton } from "@/components/app/client-portal-link-button";
import { MatterAssignmentForm } from "@/components/app/matter-assignment-form";
import { AIInsightPanel } from "@/components/ui/ai-insight-panel";
import { GradientButton } from "@/components/ui/gradient-button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";
import { formatDate, formatEnum, getMatterDetailData } from "@/lib/data/workspace-repository";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getMatterIntelligence } from "@/lib/services/aria-intelligence";
import { canManageTeam, hasFirmWideAccess, hasPermission, hasTeamOversight, roleLabel } from "@/lib/services/roles";

export default async function MatterDetailPage({ params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Matters">
        <div className="space-y-6">
          <PageHeader title="Workspace setup required" description="Create or join a workspace to review matter records." />
        </div>
      </AppShell>
    );
  }

  const matter = await getMatterDetailData(context.workspace.id, params.matterId, context.user);
  if (!matter) notFound();

  const intelligence = await getMatterIntelligence({ matterId: matter.id, user: context.user });
  const openTasks = matter.tasks.filter((task) => task.status !== "DONE").length;
  const openIssues = matter.validationIssues.filter((issue) => issue.resolutionStatus !== "RESOLVED" && issue.resolutionStatus !== "DISMISSED");
  const pendingClientActions = [
    ...matter.intakeRequests.filter((request) => request.status !== "REVIEWED"),
    ...matter.documentRequests.filter((request) => request.status !== "COMPLETED")
  ].length;
  const latestDraft = matter.applicationDrafts[0];
  const canReassign = canManageTeam(context.user) || hasFirmWideAccess(context.user) || hasTeamOversight(context.user);
  const canManageClients = hasPermission(context.user, "can_manage_clients");
  const assignableUsers = canReassign
    ? await prisma.user.findMany({
      where: { workspaceId: context.workspace.id, status: { not: "DISABLED" } },
      orderBy: { name: "asc" }
    })
    : [];

  const actionLinks = [
    { label: "Draft review", href: matter.visaSubclass === "500" ? `/app/matters/${matter.id}/draft` : "/app/forms" },
    { label: "Checklist", href: `/app/matters/${matter.id}/checklist` },
    { label: "Documents", href: "/app/documents" },
    { label: "Validation", href: "/app/validation" },
    { label: "Generated docs", href: `/app/matters/${matter.id}/generated-documents` },
    { label: "Ask Aria", href: "/app/assistant" }
  ];

  return (
    <AppShell title="Matters">
      <div className="space-y-8">
        <PageHeader
          eyebrow="MATTER WORKBENCH"
          title={`${matter.client.firstName} ${matter.client.lastName}`}
          description={matter.title}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info">{matter.visaSubclass}</StatusPill>
              <StatusPill>{formatEnum(matter.stage)}</StatusPill>
              <StatusPill tone={matter.readinessScore >= 80 ? "success" : matter.readinessScore >= 60 ? "warning" : "danger"}>
                {matter.readinessScore}% ready
              </StatusPill>
            </div>
          }
        />

        <AIInsightPanel
          eyebrow="Aria matter intelligence"
          title={intelligence.matterHealth}
          summary={intelligence.summary}
          statusLabel="Review required"
          action={
            matter.visaSubclass === "500" ? (
              <Link href={`/app/matters/${matter.id}/draft`}>
                <GradientButton>Open draft review</GradientButton>
              </Link>
            ) : (
              <Link href={`/app/matters/${matter.id}/checklist`}>
                <GradientButton>Open checklist</GradientButton>
              </Link>
            )
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            <SectionCard className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Next best action</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">{intelligence.nextBestAction}</p>
            </SectionCard>
            <SectionCard className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Client follow-up</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">{intelligence.clientFollowUpSuggestion}</p>
            </SectionCard>
            <SectionCard className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Final review note</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">{intelligence.finalReviewNote}</p>
            </SectionCard>
          </div>
        </AIInsightPanel>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Readiness" value={`${matter.readinessScore}%`} hint="Current submission-readiness score." accent={matter.readinessScore >= 80 ? "emerald" : matter.readinessScore >= 60 ? "amber" : "red"} />
          <MetricCard label="Documents" value={matter.documents.length} hint="Files linked to this matter." accent="cyan" />
          <MetricCard label="Validation issues" value={openIssues.length} hint="Open issues still needing review." accent={openIssues.length ? "red" : "emerald"} />
          <MetricCard label="Pending client actions" value={pendingClientActions} hint="Intake, doc requests, and linked review items." accent={pendingClientActions ? "amber" : "emerald"} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-6">
            <PageSection eyebrow="WORKFLOW" title="Continue the matter" description="Use the existing live workflows below to move the matter forward without leaving the review trail.">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {actionLinks.map((action) => (
                  <Link key={action.label} href={action.href as any}>
                    <SectionCard className="h-full p-4 transition hover:bg-white/[0.05]">
                      <p className="text-sm font-semibold text-white">{action.label}</p>
                      <p className="mt-2 text-sm text-slate-400">Open the linked workspace for this matter.</p>
                    </SectionCard>
                  </Link>
                ))}
              </div>
            </PageSection>

            <PageSection title="Matter review signals" description="Current evidence, draft, and checklist signals grounded in stored workspace data.">
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">Evidence gaps</h3>
                    <StatusPill tone={intelligence.evidenceGaps.length ? "warning" : "success"}>
                      {intelligence.evidenceGaps.length ? "Needs attention" : "Covered"}
                    </StatusPill>
                  </div>
                  <ul className="space-y-2">
                    {intelligence.evidenceGaps.length ? intelligence.evidenceGaps.map((item) => (
                      <li key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">{item}</li>
                    )) : <li className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">No obvious evidence gap is currently visible from the checklist and document links.</li>}
                  </ul>
                </SectionCard>

                <SectionCard className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">Draft blockers</h3>
                    <StatusPill tone={intelligence.draftWeaknesses.length ? "danger" : "success"}>
                      {intelligence.draftWeaknesses.length ? "Review required" : "Stable"}
                    </StatusPill>
                  </div>
                  <ul className="space-y-2">
                    {intelligence.draftWeaknesses.length ? intelligence.draftWeaknesses.map((item) => (
                      <li key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">{item}</li>
                    )) : <li className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">No major draft blocker is visible from the current field review state.</li>}
                  </ul>
                </SectionCard>

                <SectionCard className="space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">Risk warnings</h3>
                    <StatusPill tone={intelligence.riskWarnings.length ? "warning" : "success"}>
                      {intelligence.riskWarnings.length ? `${intelligence.riskWarnings.length} flagged` : "No current flags"}
                    </StatusPill>
                  </div>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {intelligence.riskWarnings.length ? intelligence.riskWarnings.map((item) => (
                      <li key={item} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-300">{item}</li>
                    )) : <li className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400 md:col-span-2">No additional risk warnings are visible for this matter right now.</li>}
                  </ul>
                </SectionCard>
              </div>
            </PageSection>

            <PageSection title="Operational queues" description="The key matter-linked queues, current tasks, and update impacts in one place.">
              <div className="grid gap-4 md:grid-cols-3">
                <SectionCard className="space-y-3 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Checklist</h3>
                  {matter.checklistItems.length ? matter.checklistItems.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.required ? "Required" : "Optional"} - {formatEnum(item.status)}</p>
                    </div>
                  )) : <p className="text-sm text-slate-400">No checklist items are recorded for this matter yet.</p>}
                </SectionCard>

                <SectionCard className="space-y-3 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Open issues</h3>
                  {openIssues.length ? openIssues.slice(0, 4).map((issue) => (
                    <div key={issue.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-sm font-medium text-white">{issue.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{issue.severity} - {formatEnum(issue.resolutionStatus)}</p>
                    </div>
                  )) : <p className="text-sm text-slate-400">No unresolved validation issues are recorded.</p>}
                </SectionCard>

                <SectionCard className="space-y-3 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Update impacts</h3>
                  {matter.impacts.length ? matter.impacts.slice(0, 4).map((impact) => (
                    <div key={impact.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-sm font-medium text-white">{impact.officialUpdate.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{impact.actionRequired ?? "Review required."}</p>
                    </div>
                  )) : <p className="text-sm text-slate-400">No official update impact is linked yet.</p>}
                </SectionCard>
              </div>
            </PageSection>
          </div>

          <div className="space-y-6">
            <PageSection title="Key details" description="Core deadlines, ownership, and matter metadata.">
              <SectionCard className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Assigned agent</p>
                    <p className="mt-2 text-sm font-medium text-white">{matter.assignedToUser.name ?? matter.assignedToUser.email}</p>
                    <p className="mt-1 text-xs text-slate-400">{roleLabel(matter.assignedToUser.role)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Matter reference</p>
                    <p className="mt-2 text-sm font-medium text-white">{matter.matterReference ?? matter.id.slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-slate-400">Client ref {matter.client.clientReference ?? matter.client.id.slice(0, 8)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current visa</p>
                    <p className="mt-2 text-sm font-medium text-white">{matter.currentVisaStatus || "Not set"}</p>
                    <p className="mt-1 text-xs text-slate-400">Expiry {formatDate(matter.currentVisaExpiry)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Application status</p>
                    <p className="mt-2 text-sm font-medium text-white">{matter.applicationStatus || "Not set"}</p>
                    <p className="mt-1 text-xs text-slate-400">Critical deadline {formatDate(matter.criticalDeadline)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Lodgement target</p>
                    <p className="mt-2 text-sm font-medium text-white">{formatDate(matter.lodgementTargetDate)}</p>
                    <p className="mt-1 text-xs text-slate-400">Status {formatEnum(matter.status)}</p>
                  </div>
                </div>
              </SectionCard>
            </PageSection>

            {canReassign ? (
              <PageSection title="Assignment">
                <SectionCard>
                  <MatterAssignmentForm
                    matterId={matter.id}
                    currentAssigneeId={matter.assignedToUserId}
                    users={assignableUsers.map((user) => ({ id: user.id, name: user.name, email: user.email, roleLabel: roleLabel(user.role) }))}
                  />
                </SectionCard>
              </PageSection>
            ) : null}

            <PageSection title="Timeline">
              <SectionCard className="space-y-3">
                {matter.timelineEvents.length ? matter.timelineEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{event.title}</p>
                      <p className="text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
                    </div>
                    {event.description ? <p className="mt-2 text-sm text-slate-300">{event.description}</p> : null}
                  </div>
                )) : <p className="text-sm text-slate-400">No timeline events are recorded yet.</p>}
              </SectionCard>
            </PageSection>

            <PageSection title="Client-facing workflows">
              <SectionCard className="space-y-3">
                <p className="text-sm text-slate-300">Create secure intake, checklist, and portal actions without exposing public matter data.</p>
                {canManageClients ? <ClientPortalLinkButton clientId={matter.clientId} matterId={matter.id} /> : null}
                <div className="grid gap-2">
                  <Link href="/app/intake"><SubtleButton className="w-full justify-start">Send or review intake request</SubtleButton></Link>
                  <Link href={`/app/matters/${matter.id}/checklist`}><SubtleButton className="w-full justify-start">Open visa checklist</SubtleButton></Link>
                  <Link href={`/app/matters/${matter.id}/generated-documents`}><SubtleButton className="w-full justify-start">Generate migration documents</SubtleButton></Link>
                </div>
              </SectionCard>
            </PageSection>

            <PageSection title="Draft workflow">
              <SectionCard className="space-y-3">
                {matter.visaSubclass === "500" ? (
                  <>
                    <p className="text-sm text-slate-300">The Subclass 500 draft workspace is ready for source-linked field review, validation, evidence packaging, and final cross-check.</p>
                    <Link href={`/app/matters/${matter.id}/draft`}>
                      <GradientButton className="w-full">Open draft workflow</GradientButton>
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-300">Field-level draft filling is currently configured only for Subclass 500. Other subclasses continue to use live knowledge and review workflows without fabricated fields.</p>
                    <Link href="/app/knowledge">
                      <SubtleButton className="w-full">Review visa knowledge</SubtleButton>
                    </Link>
                  </>
                )}
                {latestDraft ? <p className="text-xs text-slate-500">Latest draft status: {formatEnum(latestDraft.status)}</p> : null}
              </SectionCard>
            </PageSection>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
