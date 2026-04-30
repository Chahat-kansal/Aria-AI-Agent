import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { MatterAssignmentForm } from "@/components/app/matter-assignment-form";
import { ClientPortalLinkButton } from "@/components/app/client-portal-link-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
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
            <Link key={label} href={href as any} className={`rounded-full px-3 py-1 ${idx === 0 ? "bg-accent/20 text-accent" : "bg-white/60 text-muted hover:bg-white"}`}>
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Status</p><p className="font-medium">{formatEnum(matter.status)}</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Stage</p><p className="font-medium">{formatEnum(matter.stage)}</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Readiness</p><p className="font-medium">{matter.readinessScore}%</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Lodgement target</p><p className="font-medium">{formatDate(matter.lodgementTargetDate)}</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Current visa</p><p className="font-medium">{matter.currentVisaStatus || "Not set"}</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Visa expiry</p><p className="font-medium">{formatDate(matter.currentVisaExpiry)}</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Application status</p><p className="font-medium">{matter.applicationStatus || "Not set"}</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Critical deadline</p><p className="font-medium">{formatDate(matter.criticalDeadline)}</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Matter ref</p><p className="font-medium">{matter.matterReference ?? matter.id.slice(0, 8)}</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3"><p className="text-muted">Client ref</p><p className="font-medium">{matter.client.clientReference ?? matter.client.id.slice(0, 8)}</p></div>
          <div className="rounded-lg border border-border bg-white/45 p-3 md:col-span-2"><p className="text-muted">Assigned staff</p><p className="font-medium">{matter.assignedToUser.name ?? matter.assignedToUser.email} - {roleLabel(matter.assignedToUser.role)}</p></div>
        </div>
      </Card>

      {canReassign ? (
        <Card className="mt-4">
          <h3 className="font-semibold">Matter assignment</h3>
          <p className="mt-1 text-sm text-muted">Reassign this matter and linked client ownership within your company workspace. Access stays constrained by role and assignment scope.</p>
          <MatterAssignmentForm
            matterId={matter.id}
            currentAssigneeId={matter.assignedToUserId}
            users={assignableUsers.map((user) => ({ id: user.id, name: user.name, email: user.email, roleLabel: roleLabel(user.role) }))}
          />
        </Card>
      ) : null}

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Checklist summary</h3>
          {matter.checklistItems.length ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-muted">
              {matter.checklistItems.slice(0, 6).map((item) => <li key={item.id}>{item.label}: {item.status}</li>)}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No checklist items are recorded for this matter yet.</p>
          )}
        </Card>
        <Card>
          <h3 className="font-semibold">Flagged issues</h3>
          {openIssues.length ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-muted">{openIssues.slice(0, 4).map((issue) => <li key={issue.id}>{issue.title}</li>)}</ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No unresolved validation issues are recorded.</p>
          )}
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Aria matter intelligence</h3>
              <p className="mt-1 text-sm text-muted">
                {intelligence.status === "ai"
                  ? "AI-assisted operational review grounded in current matter, draft, validation, and update data."
                  : intelligence.status === "not_configured"
                    ? "Grounded matter analysis is available, but the AI layer is not configured yet."
                    : "Grounded operational analysis generated from current matter data."}
              </p>
            </div>
            <StatusChip label={matter.readinessScore >= 85 && openIssues.length === 0 ? "low" : matter.readinessScore >= 65 ? "medium" : "high"} />
          </div>
          {intelligence.status === "not_configured" && intelligence.configMessage ? (
            <p className="mt-3 rounded-lg border border-border bg-white/60 p-3 text-xs text-muted">{intelligence.configMessage}</p>
          ) : null}
          <p className="mt-4 rounded-xl border border-border bg-white/55 p-4 text-sm leading-7">{intelligence.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Matter health</p>
              <p className="mt-2 font-medium">{intelligence.matterHealth}</p>
            </div>
            <div className="rounded-xl border border-border bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Next best action</p>
              <p className="mt-2 font-medium">{intelligence.nextBestAction}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium">Evidence gaps</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {intelligence.evidenceGaps.length ? intelligence.evidenceGaps.map((item) => (
                  <li key={item} className="rounded-lg border border-border bg-white/55 p-3">{item}</li>
                )) : <li className="rounded-lg border border-border bg-white/55 p-3">No immediate evidence gaps are visible from the stored checklist and document links.</li>}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium">Draft weaknesses</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {intelligence.draftWeaknesses.length ? intelligence.draftWeaknesses.map((item) => (
                  <li key={item} className="rounded-lg border border-border bg-white/55 p-3">{item}</li>
                )) : <li className="rounded-lg border border-border bg-white/55 p-3">No major draft weaknesses are currently visible from the stored review state.</li>}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium">Risk warnings</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {intelligence.riskWarnings.length ? intelligence.riskWarnings.map((item) => (
                  <li key={item} className="rounded-lg border border-border bg-white/55 p-3">{item}</li>
                )) : <li className="rounded-lg border border-border bg-white/55 p-3">No additional risk warnings are visible for this matter right now.</li>}
              </ul>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold">Aria follow-up guidance</h3>
          <div className="mt-3 space-y-3 text-sm text-muted">
            <div className="rounded-xl border border-border bg-white/55 p-4">
              <p className="text-xs uppercase tracking-[0.14em]">Client follow-up suggestion</p>
              <p className="mt-2 leading-7">{intelligence.clientFollowUpSuggestion}</p>
            </div>
            <div className="rounded-xl border border-border bg-white/55 p-4">
              <p className="text-xs uppercase tracking-[0.14em]">Final review note</p>
              <p className="mt-2 leading-7">{intelligence.finalReviewNote}</p>
            </div>
            <div className="rounded-xl border border-border bg-white/55 p-4">
              <p className="text-xs uppercase tracking-[0.14em]">Useful next links</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/app/matters/${matter.id}/draft` as any} className="rounded-lg border border-border bg-white/80 px-3 py-2 text-accent">Draft review</Link>
                <Link href={`/app/matters/${matter.id}/checklist` as any} className="rounded-lg border border-border bg-white/80 px-3 py-2 text-accent">Checklist</Link>
                <Link href="/app/document-requests" className="rounded-lg border border-border bg-white/80 px-3 py-2 text-accent">Document requests</Link>
                <Link href="/app/assistant" className="rounded-lg border border-border bg-white/80 px-3 py-2 text-accent">Ask Aria</Link>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="font-semibold">Documents</h3>
          <p className="mt-2 text-sm text-muted">{matter.documents.length} linked files</p>
          <Link href="/app/documents" className="mt-3 inline-flex text-sm text-accent">Upload or review documents</Link>
        </Card>
        <Card>
          <h3 className="font-semibold">Potential impacts</h3>
          <p className="mt-2 text-sm text-muted">{matter.impacts.length} update matches</p>
          {matter.impacts[0] ? (
            <p className="mt-2 text-xs text-muted">{matter.impacts[0].officialUpdate.title}: {matter.impacts[0].actionRequired ?? "Review required."}</p>
          ) : null}
        </Card>
        <Card>
          <h3 className="font-semibold">Open tasks</h3>
          <p className="mt-2 text-sm text-muted">{openTasks} active tasks</p>
          <Link href="/app/tasks" className="mt-3 inline-flex text-sm text-accent">Open tasks</Link>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h3 className="font-semibold">Case timeline</h3>
          <div className="mt-3 space-y-2">
            {matter.timelineEvents.length ? matter.timelineEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-border bg-white/55 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-muted">{event.createdAt.toLocaleString("en-AU")}</p>
                </div>
                {event.description ? <p className="mt-2 text-sm text-muted">{event.description}</p> : null}
              </div>
            )) : <p className="text-sm text-muted">No timeline events are recorded yet.</p>}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold">Client-facing workflows</h3>
          <p className="mt-2 text-sm text-muted">Create secure links for the client portal, checklist uploads, and review stages. Links are token-based and scoped to this matter.</p>
          {hasPermission(context.user, "can_manage_clients") ? (
            <div className="mt-4">
              <ClientPortalLinkButton clientId={matter.clientId} matterId={matter.id} />
            </div>
          ) : null}
          <div className="mt-4 space-y-2 text-sm">
            <Link href={"/app/intake" as any} className="block rounded-lg border border-border bg-white/55 px-3 py-2 text-accent">Send or review intake request</Link>
            <Link href={`/app/matters/${matter.id}/checklist` as any} className="block rounded-lg border border-border bg-white/55 px-3 py-2 text-accent">Open visa checklist</Link>
            <Link href={`/app/matters/${matter.id}/generated-documents` as any} className="block rounded-lg border border-border bg-white/55 px-3 py-2 text-accent">Generate migration documents</Link>
          </div>
        </Card>
      </section>

      <Card className="mt-4">
        {matter.visaSubclass === "500" ? (
          <>
            <h3 className="font-semibold">Subclass 500 draft workflow</h3>
            <p className="mt-2 text-sm text-muted">Open the source-linked draft application workspace for document mapping, validation, evidence packaging, final cross-check, and client review preparation.</p>
            <Link href={`/app/matters/${matter.id}/draft` as any} className="mt-3 inline-flex rounded-lg bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white">Open draft workflow</Link>
          </>
        ) : (
          <>
            <h3 className="font-semibold">Draft template not yet configured</h3>
            <p className="mt-2 text-sm text-muted">Subclass {matter.visaSubclass} can use stored official visa knowledge and Aria research, but field-level draft filling is currently configured only for Subclass 500. This matter will not show fabricated draft fields.</p>
            <Link href="/app/knowledge" className="mt-3 inline-flex rounded-lg border border-border px-4 py-2 text-sm text-accent">Review visa knowledge</Link>
          </>
        )}
      </Card>
    </AppShell>
  );
}
