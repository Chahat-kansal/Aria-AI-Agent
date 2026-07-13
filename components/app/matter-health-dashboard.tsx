"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import type { MatterHealthDashboard as MatterHealthDashboardData, MatterHealthItem } from "@/lib/services/matter-health/matter-health-service";

type FilterKey = "all" | "red" | "amber" | "green";

function toneForBand(band: MatterHealthItem["band"]) {
  if (band === "green") return "success" as const;
  if (band === "amber") return "warning" as const;
  return "danger" as const;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function MatterHealthDashboard({
  dashboard,
  initialMatterId
}: {
  dashboard: MatterHealthDashboardData;
  initialMatterId?: string | null;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const items = useMemo(() => {
    const scoped = initialMatterId ? dashboard.items.filter((item) => item.matterId === initialMatterId) : dashboard.items;
    if (filter === "all") return scoped;
    return scoped.filter((item) => item.band === filter);
  }, [dashboard.items, filter, initialMatterId]);

  return (
    <div className="space-y-6">
      <SectionCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Matter health dashboard</h2>
              <StatusPill tone="warning">Agent review required</StatusPill>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              This score is advisory only. It highlights operational risk, evidence gaps, overdue actions, and review blockers without predicting visa outcomes or providing legal advice.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["all", `${dashboard.summary.visibleMatters} visible`],
              ["red", `${dashboard.summary.redBand} at risk`],
              ["amber", `${dashboard.summary.amberBand} needs attention`],
              ["green", `${dashboard.summary.greenBand} stable`]
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-2xl border px-4 py-2 text-sm transition ${
                  filter === key ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Average score" value={dashboard.summary.averageScore} hint="Advisory operational score across visible matters." accent="violet" />
          <MetricCard label="Critical blockers" value={dashboard.summary.criticalBlockers} hint="High-risk review items needing agent attention." accent={dashboard.summary.criticalBlockers ? "red" : "emerald"} />
          <MetricCard label="Overdue actions" value={dashboard.summary.overdueActions} hint="Open operational items already past due timing." accent={dashboard.summary.overdueActions ? "amber" : "emerald"} />
          <MetricCard label="Visible matters" value={dashboard.summary.visibleMatters} hint="Permission-checked matter health items in your scope." accent="cyan" />
        </div>
      </SectionCard>

      <div className="grid gap-4">
        {items.length ? items.map((item) => (
          <SectionCard key={item.matterId} className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <StatusPill tone={toneForBand(item.band)}>{item.bandLabel}</StatusPill>
                  <StatusPill tone="warning">{item.reviewRequiredWarning}</StatusPill>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {item.clientLabel} • {item.matterReference || "No matter reference"} • Subclass {item.visaSubclass} • {item.stageLabel}
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{item.summary}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Health score</p>
                <p className="mt-2 text-3xl font-semibold text-white">{item.score}</p>
                <p className="mt-2 text-xs text-slate-400">{formatDate(item.updatedAt)}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Blockers</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.blockers.length}</p>
                <p className="mt-2 text-xs text-slate-400">{item.criticalBlockerCount} critical blocker alert(s)</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Missing evidence</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.missingEvidenceSignals.reduce((sum, signal) => sum + signal.count, 0)}</p>
                <p className="mt-2 text-xs text-slate-400">Checklist and evidence links stay review-required.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Overdue actions</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.overdueActionSignals.reduce((sum, signal) => sum + signal.count, 0)}</p>
                <p className="mt-2 text-xs text-slate-400">{item.clientResponseStatus}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Readiness comparison</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.comparisonToReadiness.baseline}%</p>
                <p className="mt-2 text-xs text-slate-400">{item.comparisonToReadiness.label}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Blockers list</h4>
                    <StatusPill tone={item.blockers.length ? "danger" : "success"}>{item.blockers.length} blocker(s)</StatusPill>
                  </div>
                  <div className="mt-3 space-y-3">
                    {item.blockers.length ? item.blockers.map((signal) => (
                      <div key={signal.code} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-white">{signal.label}</p>
                          <StatusPill tone={signal.severity === "critical" ? "danger" : "warning"}>{signal.count}</StatusPill>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{signal.detail}</p>
                      </div>
                    )) : (
                      <p className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">
                        No active blocker is visible in scoped data right now.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Recommended next actions</h4>
                  <div className="mt-3 space-y-3">
                    {item.recommendedNextActions.map((action) => (
                      <div key={`${item.matterId}-${action.title}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-white">{action.title}</p>
                          <StatusPill tone={action.priority === "high" ? "danger" : action.priority === "medium" ? "warning" : "info"}>
                            {action.priority}
                          </StatusPill>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{action.detail}</p>
                        {action.route ? (
                          <Link href={action.route as any} className="mt-3 inline-flex text-sm text-cyan-300 hover:text-white">
                            Open related workflow
                          </Link>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Signals in scope</h4>
                  <div className="mt-3 space-y-3">
                    {[...item.missingEvidenceSignals, ...item.overdueActionSignals].length ? (
                      [...item.missingEvidenceSignals, ...item.overdueActionSignals].map((signal) => (
                        <div key={`${item.matterId}-${signal.code}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-white">{signal.label}</p>
                            <StatusPill tone={signal.severity === "critical" ? "danger" : signal.severity === "warning" ? "warning" : "info"}>
                              {signal.count}
                            </StatusPill>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{signal.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">
                        No missing-evidence or overdue-action signal is visible for this matter.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Scoring breakdown</h4>
                  <div className="mt-3 space-y-3">
                    {item.breakdown.map((row) => (
                      <div key={`${item.matterId}-${row.label}-${row.impact}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        <p className="text-sm text-slate-200">{row.label}</p>
                        <StatusPill tone={row.tone === "danger" ? "danger" : row.tone === "warning" ? "warning" : row.tone === "info" ? "info" : "success"}>
                          {row.impact}
                        </StatusPill>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-1">
              <p className="text-xs text-slate-500">
                {item.legalDisclaimer} {item.outcomeDisclaimer}
              </p>
              <Link href={item.route as any} className="inline-flex text-sm text-cyan-300 hover:text-white">
                Open matter
              </Link>
            </div>
          </SectionCard>
        )) : (
          <SectionCard className="p-5">
            <p className="text-sm text-slate-400">No matter health items match this filter right now.</p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
