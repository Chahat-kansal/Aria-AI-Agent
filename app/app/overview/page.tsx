import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/app/blocks/stat-card";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getOverviewData } from "@/lib/data/workspace-repository";
import { hasFirmWideAccess, hasTeamOversight, roleLabel } from "@/lib/services/roles";
import { getOverviewIntelligence } from "@/lib/services/aria-intelligence";
import Link from "next/link";

export default async function OverviewPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return <AppShell title="Overview"><PageHeader title="Workspace setup required" subtitle="Create or join a workspace to see live operational data." /></AppShell>;
  }

  const { matters, activeMatterCount, averageReadiness, openIssueCount, updates, tasks, pendingIntakes, pendingDocumentRequests, upcomingAppointments } = await getOverviewData(context.workspace.id, context.user);
  const briefing = await getOverviewIntelligence(context.workspace.id, context.user);

  return (
    <AppShell title="Overview">
      <PageHeader title={`${roleLabel(context.user.role)} Dashboard`} subtitle={`${hasFirmWideAccess(context.user) ? "Company-wide" : hasTeamOversight(context.user) ? "Team oversight" : "Assigned work"} snapshot of submission readiness, flagged inconsistencies, tasks, and update impacts.`} />
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Visible matters" value={`${activeMatterCount}`} hint={hasFirmWideAccess(context.user) ? "Company-wide scope" : "Assigned scope"} />
        <StatCard label="Avg readiness" value={`${averageReadiness}%`} hint="Review-required score" />
        <StatCard label="Open validation issues" value={`${openIssueCount}`} hint="Prioritize critical first" />
        <StatCard label="Official updates" value={`${updates.length}`} hint="Stored source-linked records" />
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-4">
        <StatCard label="Pending intakes" value={`${pendingIntakes}`} hint="Sent, viewed, or submitted" />
        <StatCard label="Pending uploads" value={`${pendingDocumentRequests}`} hint="Outstanding document requests" />
        <StatCard label="Upcoming appointments" value={`${upcomingAppointments.length}`} hint="Booked consultations" />
        <StatCard label="Open tasks" value={`${tasks.length}`} hint="Assigned follow-up work" />
      </section>

      <section className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="font-semibold">Aria Daily Briefing</h3>
              <p className="mt-1 text-sm text-muted">
                {briefing.status === "ai"
                  ? "AI-assisted priorities grounded in live workspace data, assignment scope, and current workflow risk."
                  : briefing.status === "not_configured"
                    ? "Configuration-required AI layer. Aria is showing grounded operational signals only."
                    : "Grounded operational signal summary generated from current database records."}
              </p>
            </div>
            {briefing.status === "not_configured" && briefing.configMessage ? (
              <div className="rounded-lg border border-border bg-white/60 px-3 py-2 text-xs text-muted">{briefing.configMessage}</div>
            ) : null}
          </div>
          <p className="mt-4 rounded-xl border border-border bg-white/55 p-4 text-sm leading-7 text-[#182033]">{briefing.summary}</p>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-[#182033]">Urgent actions</p>
              <div className="mt-2 space-y-2">
                {briefing.urgentActions.length ? briefing.urgentActions.map((item) => (
                  <div key={`${item.title}-${item.reason}`} className="rounded-xl border border-border bg-white/65 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{item.title}</p>
                      {item.priority ? <StatusChip label={item.priority} /> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted">{item.reason}</p>
                    {item.href ? <Link href={item.href as any} className="mt-2 inline-flex text-sm text-accent">Open</Link> : null}
                  </div>
                )) : <p className="rounded-xl border border-border bg-white/55 p-3 text-sm text-muted">No urgent blockers are visible in your current scope.</p>}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[#182033]">Client follow-ups</p>
              <div className="mt-2 space-y-2">
                {briefing.followUps.length ? briefing.followUps.map((item) => (
                  <div key={`${item.title}-${item.reason}`} className="rounded-xl border border-border bg-white/65 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{item.title}</p>
                      {item.priority ? <StatusChip label={item.priority} /> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted">{item.reason}</p>
                    {item.href ? <Link href={item.href as any} className="mt-2 inline-flex text-sm text-accent">Open</Link> : null}
                  </div>
                )) : <p className="rounded-xl border border-border bg-white/55 p-3 text-sm text-muted">No client follow-up queue is visible right now.</p>}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[#182033]">Risk warnings</p>
              <div className="mt-2 space-y-2">
                {briefing.riskWarningsDetailed.length ? briefing.riskWarningsDetailed.map((item) => (
                  <div key={`${item.title}-${item.reason}`} className="rounded-xl border border-border bg-white/65 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{item.title}</p>
                      {item.priority ? <StatusChip label={item.priority} /> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted">{item.reason}</p>
                    {item.href ? <Link href={item.href as any} className="mt-2 inline-flex text-sm text-accent">Review</Link> : null}
                  </div>
                )) : <p className="rounded-xl border border-border bg-white/55 p-3 text-sm text-muted">No additional risk warnings are visible right now.</p>}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm font-medium text-[#182033]">Recommended order of work</p>
              <ol className="mt-2 space-y-2">
                {briefing.recommendedOrder.length ? briefing.recommendedOrder.map((item, index) => (
                  <li key={item} className="flex gap-3 rounded-xl border border-border bg-white/60 p-3 text-sm text-muted">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#182033] text-xs font-semibold text-white">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                )) : <li className="rounded-xl border border-border bg-white/55 p-3 text-sm text-muted">No special work ordering is required. Continue through assigned matters and scheduled follow-ups.</li>}
              </ol>
            </div>
            {briefing.workload.length ? (
              <div>
                <p className="text-sm font-medium text-[#182033]">Team workload</p>
                <div className="mt-2 space-y-2">
                  {briefing.workload.slice(0, 6).map((member) => (
                    <div key={member.userId} className="rounded-xl border border-border bg-white/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted">{member.role}</p>
                        </div>
                        <div className="text-right text-xs text-muted">
                          <p>{member.activeMatters} matter(s)</p>
                          <p>{member.openTasks} open task(s)</p>
                          <p>{member.pendingReviews} review item(s)</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Matters needing attention</h3>
          <div className="mt-3 space-y-2">
            {matters.length ? matters.map((matter) => (
              <div key={matter.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{matter.client.firstName} {matter.client.lastName}</p>
                  <p className="text-xs text-muted">Subclass {matter.visaSubclass} - {formatEnum(matter.stage)} - Owner {matter.assignedToUser.name}</p>
                </div>
                <div className="text-right">
                  <StatusChip label={matter.readinessScore < 55 || matter.validationIssues.length > 2 ? "high" : matter.validationIssues.length ? "medium" : "low"} />
                  <p className="mt-1 text-xs text-muted">{matter.readinessScore}% readiness</p>
                </div>
              </div>
            )) : (
              <p className="rounded-lg border border-border p-4 text-sm text-muted">No matters yet. Create a matter to start tracking readiness and review work.</p>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold">Official update alerts</h3>
          <div className="mt-3 space-y-2">
            {updates.length ? updates.map((update) => (
              <div key={update.id} className="rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{update.title}</p>
                  <p className="text-xs text-muted">{update.source} - {formatDate(update.publishedAt)} - {update.impacts.length} potential impacts</p>
                </div>
                <Link href={`/app/updates/${update.id}` as any} className="mt-2 inline-flex text-sm text-accent">Open update</Link>
              </div>
            )) : (
              <p className="rounded-lg border border-border p-4 text-sm text-muted">No official update alerts are recorded for this workspace.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <h3 className="font-semibold">Upcoming tasks</h3>
          <div className="mt-3 space-y-2">
            {tasks.length ? tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted">Due {formatDate(task.dueDate)} - {task.matter.client.firstName} {task.matter.client.lastName}</p>
                </div>
                <StatusChip label={formatEnum(task.priority)} />
              </div>
            )) : (
              <p className="rounded-lg border border-border p-4 text-sm text-muted">No open tasks are recorded for this workspace.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <h3 className="font-semibold">Upcoming appointments</h3>
          <div className="mt-3 space-y-2">
            {upcomingAppointments.length ? upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{appointment.meetingType}</p>
                  <p className="text-xs text-muted">{appointment.matter?.client.firstName} {appointment.matter?.client.lastName} - {appointment.startsAt.toLocaleString("en-AU")}</p>
                </div>
                <StatusChip label={appointment.status.toLowerCase()} />
              </div>
            )) : (
              <p className="rounded-lg border border-border p-4 text-sm text-muted">No upcoming appointments are scheduled yet.</p>
            )}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
