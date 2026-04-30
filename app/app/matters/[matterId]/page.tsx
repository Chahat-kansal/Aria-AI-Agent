import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { MatterAssignmentForm } from "@/components/app/matter-assignment-form";
import { ClientPortalLinkButton } from "@/components/app/client-portal-link-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getMatterDetailData } from "@/lib/data/workspace-repository";
import { prisma } from "@/lib/prisma";
import { getMatterIntelligence } from "@/lib/services/aria-intelligence";
import { canManageTeam, hasFirmWideAccess, hasPermission, hasTeamOversight, roleLabel } from "@/lib/services/roles";

export default async function MatterDetailPage({ params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return <AppShell title="Matters"><PageHeader title="Workspace setup required" subtitle="Create or join a workspace to review matter records." /></AppShell>;

  const matter = await getMatterDetailData(context.workspace.id, params.matterId, context.user);
  if (!matter) notFound();
  const intelligence = await getMatterIntelligence({ matterId: matter.id, user: context.user });

  const openTasks = matter.tasks.filter((task) => task.status !== "DONE").length;
  const openIssues = matter.validationIssues.filter((issue) => issue.resolutionStatus !== "RESOLVED" && issue.resolutionStatus !== "DISMISSED");
  const canReassign = canManageTeam(context.user) || hasFirmWideAccess(context.user) || hasTeamOversight(context.user);
  const assignableUsers = canReassign
    ? await prisma.user.findMany({
      where: { workspaceId: context.workspace.id, status: { not: "DISABLED" } },
      orderBy: { name: "asc" }
    })
    : [];
  const workflowLinks = [
    ["Overview", `/app/matters/${matter.id}`],
    ["Upload documents", "/app/documents"],
    ["Checklist", `/app/matters/${matter.id}/checklist`],
    ["Field review", matter.visaSubclass === "500" ? `/app/matters/${matter.id}/draft` : "/app/forms"],
    ["Generated docs", `/app/matters/${matter.id}/generated-documents`],
    ["Validation", "/app/validation"],
    ["Tasks", "/app/tasks"],
    ["Updates", "/app/updates"],
    ["Ask Aria", "/app/assistant"]
  ] as const;

  return (
    <AppShell title="Matters">
      <PageHeader title={`${matter.client.firstName} ${matter.client.lastName} - ${matter.title}`} subtitle="AI-assisted matter workspace with source-linked review controls." />
      <Card>
        <div className="flex flex-wrap gap-2 text-sm">
          {workflowLinks.map(([label, href], idx) => (
            <Link key={label} href={href as any} className={idx === 0 ? "rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-300" : "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"}>
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Status" value={formatEnum(matter.status)} hint={`Stage: ${formatEnum(matter.stage)}`} tone="info" />
          <StatCard label="Readiness" value={`${matter.readinessScore}%`} hint={`Open issues: ${openIssues.length}`} tone={matter.readinessScore >= 85 ? "success" : matter.readinessScore >= 65 ? "warning" : "danger"} />
          <StatCard label="Visa expiry" value={formatDate(matter.currentVisaExpiry) || "Not set"} hint={matter.currentVisaStatus || "Current visa not set"} tone="warning" />
          <StatCard label="Critical deadline" value={formatDate(matter.criticalDeadline) || "Not set"} hint={matter.applicationStatus || "Application status not set"} tone="danger" />
        </div>
        <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          <div className="aria-note">Lodgement target<br /><span className="text-white">{formatDate(matter.lodgementTargetDate)}</span></div>
          <div className="aria-note">Matter ref<br /><span className="text-white">{matter.matterReference ?? matter.id.slice(0, 8)}</span></div>
          <div className="aria-note">Client ref<br /><span className="text-white">{matter.client.clientReference ?? matter.client.id.slice(0, 8)}</span></div>
          <div className="aria-note">Current visa<br /><span className="text-white">{matter.currentVisaStatus || "Not set"}</span></div>
          <div className="aria-note">Application status<br /><span className="text-white">{matter.applicationStatus || "Not set"}</span></div>
          <div className="aria-note md:col-span-1">Assigned staff<br /><span className="text-white">{matter.assignedToUser.name ?? matter.assignedToUser.email} - {roleLabel(matter.assignedToUser.role)}</span></div>
        </div>
      </Card>

      {canReassign ? (
        <Card className="mt-6">
          <h3 className="text-xl font-semibold tracking-tight text-white">Matter assignment</h3>
          <p className="mt-1 text-sm leading-6 text-slate-300">Reassign this matter and linked client ownership within your company workspace. Access stays constrained by role and assignment scope.</p>
          <MatterAssignmentForm
            matterId={matter.id}
            currentAssigneeId={matter.assignedToUserId}
            users={assignableUsers.map((user) => ({ id: user.id, name: user.name, email: user.email, roleLabel: roleLabel(user.role) }))}
          />
        </Card>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Checklist summary</h3>
          {matter.checklistItems.length ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {matter.checklistItems.slice(0, 6).map((item) => <li key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">{item.label}: {item.status}</li>)}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No checklist items are recorded for this matter yet.</p>
          )}
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Flagged issues</h3>
          {openIssues.length ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">{openIssues.slice(0, 4).map((issue) => <li key={issue.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">{issue.title}</li>)}</ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No unresolved validation issues are recorded.</p>
          )}
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <AIInsightCard
            summary={intelligence.summary}
            actions={
              <>
                <Link href={`/app/matters/${matter.id}/draft` as any} className="aria-chip-link">Draft review</Link>
                <Link href={`/app/matters/${matter.id}/checklist` as any} className="aria-chip-link">Checklist</Link>
                <Link href="/app/assistant" className="aria-chip-link">Ask Aria</Link>
              </>
            }
          />
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-white">Matter intelligence</h3>
                <p className="mt-1 text-sm text-slate-300">
                  {intelligence.status === "ai"
                    ? "AI-assisted operational review grounded in current matter, draft, validation, and update data."
                    : intelligence.status === "not_configured"
                      ? "Grounded matter analysis is available, but the AI layer is not configured yet."
                      : "Grounded operational analysis generated from current matter data."}
                </p>
              </div>
              <StatusPill tone={matter.readinessScore >= 85 && openIssues.length === 0 ? "success" : matter.readinessScore >= 65 ? "warning" : "danger"}>
                {matter.readinessScore >= 85 && openIssues.length === 0 ? "low risk" : matter.readinessScore >= 65 ? "medium risk" : "high risk"}
              </StatusPill>
            </div>
            {intelligence.status === "not_configured" && intelligence.configMessage ? (
              <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">{intelligence.configMessage}</p>
            ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="aria-surface p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Matter health</p>
              <p className="mt-2 font-medium text-white">{intelligence.matterHealth}</p>
            </div>
            <div className="aria-surface p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Next best action</p>
              <p className="mt-2 font-medium text-white">{intelligence.nextBestAction}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-white">Evidence gaps</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {intelligence.evidenceGaps.length ? intelligence.evidenceGaps.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">{item}</li>
                )) : <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">No immediate evidence gaps are visible from the stored checklist and document links.</li>}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Draft weaknesses</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {intelligence.draftWeaknesses.length ? intelligence.draftWeaknesses.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">{item}</li>
                )) : <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">No major draft weaknesses are currently visible from the stored review state.</li>}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Risk warnings</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {intelligence.riskWarnings.length ? intelligence.riskWarnings.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">{item}</li>
                )) : <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">No additional risk warnings are visible for this matter right now.</li>}
              </ul>
            </div>
          </div>
          </Card>
        </div>

        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Aria follow-up guidance</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Client follow-up suggestion</p>
              <p className="mt-2 leading-7">{intelligence.clientFollowUpSuggestion}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Final review note</p>
              <p className="mt-2 leading-7">{intelligence.finalReviewNote}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Useful next links</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/app/matters/${matter.id}/draft` as any} className="aria-chip-link">Draft review</Link>
                <Link href={`/app/matters/${matter.id}/checklist` as any} className="aria-chip-link">Checklist</Link>
                <Link href="/app/document-requests" className="aria-chip-link">Document requests</Link>
                <Link href="/app/assistant" className="aria-chip-link">Ask Aria</Link>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Documents</h3>
          <p className="mt-2 text-sm text-slate-300">{matter.documents.length} linked files</p>
          <Link href="/app/documents" className="mt-3 inline-flex text-sm text-cyan-300 transition hover:text-white">Upload or review documents</Link>
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Potential impacts</h3>
          <p className="mt-2 text-sm text-slate-300">{matter.impacts.length} update matches</p>
          {matter.impacts[0] ? (
            <p className="mt-2 text-xs text-slate-400">{matter.impacts[0].officialUpdate.title}: {matter.impacts[0].actionRequired ?? "Review required."}</p>
          ) : null}
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Open tasks</h3>
          <p className="mt-2 text-sm text-slate-300">{openTasks} active tasks</p>
          <Link href="/app/tasks" className="mt-3 inline-flex text-sm text-cyan-300 transition hover:text-white">Open tasks</Link>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Case timeline</h3>
          <div className="mt-3 space-y-2">
            {matter.timelineEvents.length ? matter.timelineEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{event.title}</p>
                  <p className="text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
                </div>
                {event.description ? <p className="mt-2 text-sm text-slate-300">{event.description}</p> : null}
              </div>
            )) : <p className="text-sm text-slate-400">No timeline events are recorded yet.</p>}
          </div>
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Client-facing workflows</h3>
          <p className="mt-2 text-sm text-slate-300">Create secure links for the client portal, checklist uploads, and review stages. Links are token-based and scoped to this matter.</p>
          {hasPermission(context.user, "can_manage_clients") ? (
            <div className="mt-4">
              <ClientPortalLinkButton clientId={matter.clientId} matterId={matter.id} />
            </div>
          ) : null}
          <div className="mt-4 space-y-2 text-sm">
            <Link href={"/app/intake" as any} className="block rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-cyan-300 transition hover:bg-white/[0.08] hover:text-white">Send or review intake request</Link>
            <Link href={`/app/matters/${matter.id}/checklist` as any} className="block rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-cyan-300 transition hover:bg-white/[0.08] hover:text-white">Open visa checklist</Link>
            <Link href={`/app/matters/${matter.id}/generated-documents` as any} className="block rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-cyan-300 transition hover:bg-white/[0.08] hover:text-white">Generate migration documents</Link>
          </div>
        </Card>
      </section>

      <Card className="mt-6">
        {matter.visaSubclass === "500" ? (
          <>
            <h3 className="text-xl font-semibold tracking-tight text-white">Subclass 500 draft workflow</h3>
            <p className="mt-2 text-sm text-slate-300">Open the source-linked draft application workspace for document mapping, validation, evidence packaging, final cross-check, and client review preparation.</p>
            <Link href={`/app/matters/${matter.id}/draft` as any} className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95">Open draft workflow</Link>
          </>
        ) : (
          <>
            <h3 className="text-xl font-semibold tracking-tight text-white">Draft template not yet configured</h3>
            <p className="mt-2 text-sm text-slate-300">Subclass {matter.visaSubclass} can use stored official visa knowledge and Aria research, but field-level draft filling is currently configured only for Subclass 500. This matter will not show fabricated draft fields.</p>
            <Link href="/app/knowledge" className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-cyan-300 transition hover:bg-white/[0.08] hover:text-white">Review visa knowledge</Link>
          </>
        )}
      </Card>
    </AppShell>
  );
}
