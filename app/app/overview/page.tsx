import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Files,
  FolderKanban,
  ShieldAlert,
  Sparkles,
  Activity
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { AIInsightPanel } from "@/components/ui/ai-insight-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { GradientButton } from "@/components/ui/gradient-button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getOverviewData } from "@/lib/data/workspace-repository";
import { getOverviewIntelligence } from "@/lib/services/aria-intelligence";
import { hasFirmWideAccess, hasPermission, hasTeamOversight, roleLabel } from "@/lib/services/roles";

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
          <PageHeader eyebrow="Briefing" title="Your practice at a glance." description="Create or join a workspace to load real operational data." />
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
          eyebrow="Briefing"
          title="Your practice at a glance."
          description={`Aria does the admin. You stay in review. ${dashboardScope} signals are tuned to ${roleLabel(context.user.role).toLowerCase()} access.`}
          action={
            hasPermission(context.user, "can_run_pathway_analysis") ? (
              <Link href="/app/pathways" className="inline-flex">
                <GradientButton className="px-6">
                  Find pathway
                  <ArrowRight className="ml-2 h-4 w-4" />
                </GradientButton>
              </Link>
            ) : null
          }
        />

        <AIInsightPanel
          title="Today, here's what matters."
          summary={briefing.summary}
          statusLabel={briefing.urgency}
          action={briefing.status === "not_configured" ? null : (
            <Link href="/app/assistant" className="inline-flex h-10 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 hover:bg-white/[0.08]">
              Open Aria
            </Link>
          )}
        >
          {briefing.status === "not_configured" && briefing.configMessage ? (
            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              {briefing.configMessage}
            </div>
          ) : null}
          {briefing.recommendedOrder.length ? (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {briefing.recommendedOrder.slice(0, 3).map((item, index) => (
                <div key={item} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">Step {index + 1}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          ) : null}
        </AIInsightPanel>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Clients" value={activeMatterCount} hint="Active client folders" icon={<Files className="h-4 w-4" />} accent="cyan" />
          <MetricCard label="Matters" value={matters.length} hint="Visible in your scope" icon={<FolderKanban className="h-4 w-4" />} accent="violet" />
          <MetricCard label="Open validation issues" value={openIssueCount} hint="Prioritize critical first" icon={<AlertTriangle className="h-4 w-4" />} accent={openIssueCount > 0 ? "amber" : "emerald"} />
          <MetricCard label="Average readiness" value={`${averageReadiness}%`} hint="Review-required score" icon={<CheckCircle2 className="h-4 w-4" />} accent={averageReadiness >= 75 ? "emerald" : averageReadiness >= 50 ? "amber" : "red"} />
          <MetricCard label="Pending intakes" value={pendingIntakes} hint="Sent, viewed, or submitted" accent={pendingIntakes > 0 ? "amber" : "cyan"} />
          <MetricCard label="Missing documents" value={pendingDocumentRequests} hint="Outstanding document requests" accent={pendingDocumentRequests > 0 ? "amber" : "emerald"} />
          <MetricCard label="Appointments" value={upcomingAppointments.length} hint="Upcoming consultations" accent="cyan" />
          <MetricCard label="Official updates" value={updates.length} hint="Stored source-linked alerts" accent={updates.length ? "violet" : "emerald"} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <PageSection title="Urgent actions" description="Aria is ranking the work that most affects readiness, client follow-up, and operational risk.">
            {briefing.urgentActions.length ? (
              <div className="space-y-3">
                {briefing.urgentActions.slice(0, 3).map((item) => (
                  <SectionCard key={`${item.title}-${item.entityId}`} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-[1rem] bg-amber-400/10 text-amber-300">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-white">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-400">{item.reason}</p>
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
                  </SectionCard>
                ))}
              </div>
            ) : (
              <EmptyState title="No urgent blockers in your scope" description="Aria is not seeing critical matter blockers right now. Continue through your assigned reviews and follow-ups." />
            )}
          </PageSection>

          <PageSection title="Follow-ups and risk" description="Client outreach, security review notes, and queue friction are grouped here so nothing drifts.">
            <div className="space-y-3">
              {briefing.followUps.slice(0, 2).map((item) => (
                <SectionCard key={`${item.title}-${item.entityId}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[1rem] bg-cyan-400/10 text-cyan-300">
                        <Clock3 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{item.reason}</p>
                      </div>
                    </div>
                    <StatusPill tone={toneForPriority(item.priority)}>{item.priority}</StatusPill>
                  </div>
                </SectionCard>
              ))}

              {briefing.riskWarningsDetailed.slice(0, 2).map((item) => (
                <SectionCard key={`${item.title}-${item.entityId}`} className="border-red-400/12 bg-red-400/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[1rem] bg-red-400/10 text-red-300">
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{item.reason}</p>
                    </div>
                  </div>
                </SectionCard>
              ))}

              {!briefing.followUps.length && !briefing.riskWarningsDetailed.length ? (
                <EmptyState title="No follow-up friction detected" description="Aria is not seeing delayed client outreach or security flags in your current visible queue." />
              ) : null}
            </div>
          </PageSection>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <PageSection title="Matters needing attention" description="Live readiness, ownership, and validation pressure across your visible matter set.">
            {matters.length ? (
              <div className="space-y-3">
                {matters.slice(0, 5).map((matter) => (
                  <Link key={matter.id} href={`/app/matters/${matter.id}` as any} className="block">
                    <SectionCard className="p-4 transition hover:bg-white/[0.05]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">{matter.client.firstName} {matter.client.lastName}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            Subclass {matter.visaSubclass} - {formatEnum(matter.stage)} - {matter.assignedToUser.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <StatusPill tone={matter.readinessScore < 55 || matter.validationIssues.length > 2 ? "danger" : matter.validationIssues.length ? "warning" : "success"}>
                            {matter.readinessScore}% ready
                          </StatusPill>
                          <p className="mt-2 text-xs text-slate-500">{matter.validationIssues.length} validation issue(s)</p>
                        </div>
                      </div>
                    </SectionCard>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No matters yet"
                description="Create your first matter to start tracking readiness, document collection, validation, and Aria’s operational guidance."
                action={
                  <Link href="/app/matters" className="inline-flex h-11 items-center justify-center rounded-[1.35rem] bg-gradient-to-r from-violet-500 via-violet-400 to-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_14px_48px_rgba(34,211,238,0.22)] transition hover:scale-[1.01] hover:opacity-95">
                    Open matters
                  </Link>
                }
              />
            )}
          </PageSection>

          <PageSection title="Appointments and workload" description="Upcoming consultations plus the visible work capacity in your current scope.">
            <div className="space-y-3">
              {upcomingAppointments.slice(0, 4).map((appointment) => (
                <SectionCard key={appointment.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[1rem] bg-cyan-400/10 text-cyan-300">
                        <CalendarClock className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{appointment.meetingType}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {appointment.matter?.client.firstName} {appointment.matter?.client.lastName}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">{appointment.startsAt.toLocaleString("en-AU")}</p>
                      </div>
                    </div>
                    <StatusPill tone="info">{appointment.status.toLowerCase()}</StatusPill>
                  </div>
                </SectionCard>
              ))}

              {briefing.workload.length ? (
                <SectionCard className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Visible workload</p>
                      <p className="mt-1 text-sm text-slate-400">Real users only, shaped by your role permissions.</p>
                    </div>
                    <StatusPill tone="info">{briefing.workload.length} users</StatusPill>
                  </div>
                  <div className="mt-4 space-y-3">
                    {briefing.workload.slice(0, 4).map((member) => (
                      <div key={member.userId} className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.role}</p>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <p>{member.activeMatters} matters</p>
                          <p>{member.openTasks} tasks</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              {!upcomingAppointments.length && !briefing.workload.length ? (
                <EmptyState title="No workload signals yet" description="Appointments and visible staff capacity will appear here as your workspace fills out." />
              ) : null}
            </div>
          </PageSection>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <PageSection title="Missing documents and review queues" description="Outstanding evidence collection and assigned follow-up work in one place.">
            <div className="space-y-3">
              <SectionCard className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[1rem] bg-violet-500/10 text-violet-300">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Pending client uploads</p>
                      <p className="mt-1 text-sm text-slate-400">Outstanding document requests linked to active matters.</p>
                    </div>
                  </div>
                  <StatusPill tone={pendingDocumentRequests > 0 ? "warning" : "success"}>{pendingDocumentRequests}</StatusPill>
                </div>
              </SectionCard>

              {tasks.slice(0, 4).map((task) => (
                <SectionCard key={task.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{task.title}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Due {formatDate(task.dueDate)} - {task.matter.client.firstName} {task.matter.client.lastName}
                      </p>
                    </div>
                    <StatusPill tone={toneForPriority(task.priority)}>{formatEnum(task.priority)}</StatusPill>
                  </div>
                </SectionCard>
              ))}

              {!pendingDocumentRequests && !tasks.length ? (
                <EmptyState title="No document or task backlog" description="As intake, uploads, and follow-up work arrive, they will show up here automatically." />
              ) : null}
            </div>
          </PageSection>

          <PageSection title="Update impacts" description="Source-linked alerts and policy changes that may affect active matters.">
            <div className="space-y-3">
              {updates.slice(0, 4).map((update) => (
                <Link key={update.id} href={`/app/updates/${update.id}` as any} className="block">
                  <SectionCard className="p-4 transition hover:bg-white/[0.05]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-[1rem] bg-cyan-400/10 text-cyan-300">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{update.title}</p>
                          <p className="mt-1 text-sm text-slate-400">{update.source} - {formatDate(update.publishedAt)}</p>
                          <p className="mt-2 text-xs text-slate-500">{update.impacts.length} potential impact(s)</p>
                        </div>
                      </div>
                      <StatusPill tone={update.impacts.length ? "warning" : "info"}>{update.impacts.length} impacts</StatusPill>
                    </div>
                  </SectionCard>
                </Link>
              ))}

              {!updates.length ? (
                <EmptyState title="No update impacts in queue" description="When official alerts arrive or become relevant to active matters, Aria will surface them here." />
              ) : null}
            </div>
          </PageSection>
        </div>
      </div>
    </AppShell>
  );
}
