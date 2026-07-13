import Link from "next/link";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import type { MatterHealthItem } from "@/lib/services/matter-health/matter-health-service";

function toneForBand(band: MatterHealthItem["band"]) {
  if (band === "green") return "success" as const;
  if (band === "amber") return "warning" as const;
  return "danger" as const;
}

export function MatterHealthPanel({ item }: { item: MatterHealthItem | null }) {
  if (!item) {
    return (
      <SectionCard className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Matter health score</h3>
          <StatusPill tone="warning">Agent review required</StatusPill>
        </div>
        <p className="text-sm leading-6 text-slate-400">
          Matter health is not available in your current permission scope.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Matter health score</h3>
            <StatusPill tone="warning">{item.reviewRequiredWarning}</StatusPill>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.summary}</p>
          <p className="mt-2 text-xs text-slate-500">{item.legalDisclaimer} {item.outcomeDisclaimer}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Health score</p>
          <p className="mt-2 text-3xl font-semibold text-white">{item.score}</p>
          <div className="mt-2 flex justify-end">
            <StatusPill tone={toneForBand(item.band)}>{item.bandLabel}</StatusPill>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Blockers</p>
          <p className="mt-2 text-2xl font-semibold text-white">{item.blockers.length}</p>
          <p className="mt-2 text-xs text-slate-400">{item.criticalBlockerCount} critical blocker alert(s)</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Client response</p>
          <p className="mt-2 text-base font-semibold text-white">{item.clientResponseStatus}</p>
          <p className="mt-2 text-xs text-slate-400">{item.comparisonToReadiness.label}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Missing evidence</p>
          <p className="mt-2 text-2xl font-semibold text-white">{item.missingEvidenceSignals.reduce((sum, signal) => sum + signal.count, 0)}</p>
          <p className="mt-2 text-xs text-slate-400">Evidence-linked review stays agent-controlled.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Blockers and overdue actions</h4>
              <StatusPill tone={item.blockers.length ? "danger" : item.overdueActionSignals.length ? "warning" : "success"}>
                {item.blockers.length + item.overdueActionSignals.length} signals
              </StatusPill>
            </div>
            <div className="mt-3 space-y-3">
              {[...item.blockers, ...item.overdueActionSignals].length ? (
                [...item.blockers, ...item.overdueActionSignals].map((signal) => (
                  <div key={signal.code} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
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
                  No blocker or overdue action signal is visible in scoped data right now.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Recommended next actions</h4>
            <div className="mt-3 space-y-3">
              {item.recommendedNextActions.map((action) => (
                <div key={`${action.title}-${action.route ?? "none"}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
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
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Scoring explanation</h4>
            <div className="mt-3 space-y-3">
              {item.breakdown.map((row) => (
                <div key={`${row.label}-${row.impact}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-sm text-slate-200">{row.label}</p>
                  <StatusPill tone={row.tone === "danger" ? "danger" : row.tone === "warning" ? "warning" : row.tone === "info" ? "info" : "success"}>
                    {row.impact}
                  </StatusPill>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Evidence and response signals</h4>
            <div className="mt-3 space-y-3">
              {[...item.missingEvidenceSignals, ...item.overdueActionSignals.slice(0, 2)].length ? (
                [...item.missingEvidenceSignals, ...item.overdueActionSignals.slice(0, 2)].map((signal) => (
                  <div key={`${signal.code}-detail`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-sm font-medium text-white">{signal.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{signal.detail}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">
                  No additional missing-evidence or overdue-action signal is visible right now.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
