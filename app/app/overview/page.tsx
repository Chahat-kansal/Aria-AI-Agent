import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3, ShieldAlert, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getOverviewData } from "@/lib/data/workspace-repository";
import { getOverviewIntelligence } from "@/lib/services/aria-intelligence";
import { hasFirmWideAccess, hasTeamOversight, roleLabel } from "@/lib/services/roles";

function toneForPriority(priority?: string) {
  switch ((priority || "").toLowerCase()) {
    case "critical":
    case "high":
      return "danger" as const;
    case "medium":
      return "warning" as const;
    case "low":
      return "success" as const;
    default:
      return "info" as const;
  }
}

export default async function OverviewPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return (
      <AppShell title="Overview">
        <div className="space-y-6">
          <PageHeader title="Workspace setup required" description="Create or join a workspace to see live operational data." />
        </div>
      </AppShell>
    );
  }

  const {
    matters,
    activeMatterCount,
    averageReadiness,
    openIssueCount,
    updates,
    tasks,
    pendingIntakes,
    pendingDocumentRequests,
    upcomingAppointments
  } = await getOverviewData(context.workspace.id, context.user);
  const briefing = await getOverviewIntelligence(context.workspace.id, context.user);
  const dashboardScope = hasFirmWideAccess(context.user)
    ? "Company-wide"
    : hasTeamOversight(context.user)
      ? "Team oversight"
      : "Assigned work";

  return (
    <AppShell title="Overview">
      <div className="space-y-6">
        <PageHeader
          title={`${roleLabel(context.user.role)} Dashboard`}
          description={`${dashboardScope} snapshot of submission readiness, flagged inconsistencies, tasks, and update impacts.`}
        />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Visible matters" value={activeMatterCount} hint={hasFirmWideAccess(context.user) ? "Company-wide scope" : "Assigned scope"} tone="info" />
          <StatCard label="Avg readiness" value={`${averageReadiness}%`} hint="Review-required score" tone={averageReadiness >= 75 ? "success" : averageReadiness >= 50 ? "warning" : "danger"} />
          <StatCard label="Open validation issues" value={openIssueCount} hint="Prioritize critical first" tone={openIssueCount > 0 ? "warning" : "success"} />
          <StatCard label="Official updates" value={updates.length} hint="Stored source-linked records" tone={updates.length > 0 ? "info" : "success"} />
          <StatCard label="Pending intakes" value={pendingIntakes} hint="Sent, viewed, or submitted" tone={pendingIntakes > 0 ? "warning" : "success"} />
          <StatCard label="Pending uploads" value={pendingDocumentRequests} hint="Outstanding document requests" tone={pendingDocumentRequests > 0 ? "warning" : "success"} />
          <StatCard label="Upcoming appointments" value={upcomingAppointments.length} hint="Booked consultations" tone="info" />
          <StatCard label="Open tasks" value={tasks.length} hint="Assigned follow-up work" tone={tasks.length > 0 ? "warning" : "success"} />
        </div>

        <AIInsightCard
          title="Aria Daily Briefing"
          summary={briefing.summary}
          actions={
            <>
              {briefing.status === "not_configured" && briefing.configMessage ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                  {briefing.configMessage}
                </div>
              ) : null}
              <StatusPill tone={briefing.urgency === "critical" || briefing.urgency === "high" ? "danger" : briefing.urgency === "medium" ? "warning" : "info"}>
                {briefing.urgency} urgency
              </StatusPill>
            </>
          }
        />

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">What needs attention now</p>
                <p className="mt-1 text-sm text-slate-400">Aria is ranking the most important operational work using your live workspace data.</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            {briefing.urgentActions.length ? (
              <div className="space-y-3">
                {briefing.urgentActions.slice(0, 3).map((item) => (
                  <div key={`${item.title}-${item.entityId}`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xl font-semibold tracking-tight text-white">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{item.reason}</p>
                        </div>
                      </div>
                      <StatusPill tone={toneForPriority(item.priority)}>{item.priority}</StatusPill>
                    </div>
                    {item.href ? (
                      <Link href={item.href as any} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200">
                        Open item
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No urgent blockers in your scope"
                description="Aria is not seeing critical matter blockers right now. You can move through today’s assigned reviews and follow-ups."
              />
            )}
          </GlassCard>

          <GlassCard className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-100">Deadlines, follow-ups, and workload</p>
              <p className="mt-1 text-sm text-slate-400">The next operational queue across appointments, client outreach, and assigned team capacity.</p>
            </div>

            <div className="space-y-3">
              {(briefing.followUps.length ? briefing.followUps.slice(0, 2) : []).map((item) => (
                <div key={`${item.title}-${item.entityId}`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                        <Clock3 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{item.reason}</p>
                      </div>
                    </div>
                    <StatusPill tone={toneForPriority(item.priority)}>{item.priority}</StatusPill>
                  </div>
                </div>
              ))}

              {(briefing.riskWarningsDetailed.length ? briefing.riskWarningsDetailed.slice(0, 2) : []).map((item) => (
                <div key={`${item.title}-${item.entityId}`} className="rounded-3xl border border-red-400/15 bg-red-400/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl bg-red-400/10 text-red-300">
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{item.reason}</p>
                    </div>
                  </div>
                </div>
              ))}

              {briefing.workload.length ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Team workload snapshot</p>
                      <p className="text-sm text-slate-400">Visible users only, based on your current access level.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {briefing.workload.slice(0, 4).map((member) => (
                      <div key={member.userId} className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-slate-950/50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.role}</p>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <p>{member.activeMatters} matters</p>
                          <p>{member.openTasks} tasks</p>
                          <p>{member.pendingReviews} reviews</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Recommended order of work</p>
                <p className="mt-1 text-sm text-slate-400">Use this sequence to move the queue forward without missing review blockers.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
            {briefing.recommendedOrder.length ? (
              <ol className="space-y-3">
                {briefing.recommendedOrder.map((item, index) => (
                  <li key={item} className="flex gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-6 text-slate-300">{item}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="No special ordering required"
                description="Aria is not seeing a queue bottleneck right now. Continue through your visible matters, reviews, and scheduled follow-ups."
              />
            )}
          </GlassCard>

          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Upcoming appointments</p>
                <p className="mt-1 text-sm text-slate-400">Real scheduled consultations and checkpoints linked to matters.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <CalendarClock className="h-4 w-4" />
              </div>
            </div>
            {upcomingAppointments.length ? (
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 4).map((appointment) => (
                  <div key={appointment.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{appointment.meetingType}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {appointment.matter?.client.firstName} {appointment.matter?.client.lastName}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">{appointment.startsAt.toLocaleString("en-AU")}</p>
                      </div>
                      <StatusPill tone="info">{appointment.status.toLowerCase()}</StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No upcoming appointments"
                description="Booked consultations will appear here once matters start moving into calls or review checkpoints."
              />
            )}
          </GlassCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Matters needing attention</p>
                <p className="mt-1 text-sm text-slate-400">Live readiness and issue signals across your visible matter set.</p>
              </div>
              <StatusPill tone="warning">{matters.length} visible</StatusPill>
            </div>

            {matters.length ? (
              <div className="space-y-3">
                {matters.slice(0, 5).map((matter) => (
                  <Link key={matter.id} href={`/app/matters/${matter.id}` as any} className="block rounded-3xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.07]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{matter.client.firstName} {matter.client.lastName}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          Subclass {matter.visaSubclass} · {formatEnum(matter.stage)} · {matter.assignedToUser.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusPill tone={matter.readinessScore < 55 || matter.validationIssues.length > 2 ? "danger" : matter.validationIssues.length ? "warning" : "success"}>
                          {matter.readinessScore}% ready
                        </StatusPill>
                        <p className="mt-2 text-xs text-slate-500">{matter.validationIssues.length} validation issue(s)</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No matters yet"
                description="Create your first matter to start tracking readiness, document collection, validation, and Aria’s operational guidance."
                action={
                  <Link href="/app/matters" className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95">
                    Open matters
                  </Link>
                }
              />
            )}
          </GlassCard>

          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Updates and task queue</p>
                <p className="mt-1 text-sm text-slate-400">Source-linked updates and the most immediate follow-up work.</p>
              </div>
              <StatusPill tone={updates.length ? "info" : "neutral"}>{updates.length} updates</StatusPill>
            </div>

            <div className="space-y-3">
              {updates.slice(0, 3).map((update) => (
                <Link key={update.id} href={`/app/updates/${update.id}` as any} className="block rounded-3xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.07]">
                  <p className="text-sm font-semibold text-white">{update.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{update.source} · {formatDate(update.publishedAt)}</p>
                  <p className="mt-2 text-xs text-slate-500">{update.impacts.length} potential impact(s)</p>
                </Link>
              ))}

              {tasks.slice(0, 4).map((task) => (
                <div key={task.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{task.title}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Due {formatDate(task.dueDate)} · {task.matter.client.firstName} {task.matter.client.lastName}
                      </p>
                    </div>
                    <StatusPill tone={toneForPriority(task.priority)}>{formatEnum(task.priority)}</StatusPill>
                  </div>
                </div>
              ))}

              {!updates.length && !tasks.length ? (
                <EmptyState
                  title="No updates or tasks in queue"
                  description="When official alerts arrive or matter tasks are assigned, Aria will surface them here in the same operational view."
                />
              ) : null}
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}
