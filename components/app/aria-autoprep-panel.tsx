"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";

type ApprovalCandidate = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  reason: string;
};

type DraftBriefing = {
  title: string;
  summary: string[];
  missingFields: Array<{ label: string; status: string; source: string | null }>;
  criticalIssues: Array<{ title: string; severity: string; description: string }>;
  evidenceNotes: Array<{ fileName: string; category: string; reviewStatus: string }>;
};

type ClientConfirmation = {
  key: string;
  title: string;
  detail: string;
  status: "required" | "recommended";
};

type AutoprepResult = {
  summary: string;
  executedActions: Array<{ key: string; label: string; status: string; detail: string }>;
  approvalCandidates: ApprovalCandidate[];
  approvedResults: Array<{ key: string; label: string; status: string; detail: string }>;
  safety: {
    readyForAgentFinalReview: boolean;
    hardBlockers: Array<{ title: string; detail?: string }>;
    softBlockers: Array<{ title: string; detail?: string }>;
  };
  draftBriefing: DraftBriefing | null;
  clientConfirmations: ClientConfirmation[];
  mappedTemplateCount: number;
  missingChecklistCount: number;
};

function toneForStatus(status: string) {
  switch (status) {
    case "completed":
    case "approved":
      return "success" as const;
    case "blocked":
      return "danger" as const;
    default:
      return "warning" as const;
  }
}

export function AriaAutoprepPanel({ matterId, canRun }: { matterId: string; canRun: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AutoprepResult | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedActions = useMemo(
    () => Object.entries(selected).filter(([, value]) => value).map(([key]) => key),
    [selected]
  );

  const enabledApprovalCount = result?.approvalCandidates.filter((action) => action.enabled).length ?? 0;

  async function run(approvedActions: string[] = []) {
    setMessage(null);
    const response = await fetch(`/api/matters/${matterId}/autoprep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedActions })
    });
    const payload = await response.json().catch(() => null) as { error?: string; result?: AutoprepResult } | null;
    if (!response.ok || !payload?.result) {
      setMessage(payload?.error ?? "Aria autoprep could not be completed.");
      return;
    }
    setResult(payload.result);
    setMessage(payload.result.summary);
    setSelected({});
    startTransition(() => router.refresh());
  }

  if (!canRun) {
    return (
      <div className="aria-surface rounded-[1.6rem] p-4 text-sm text-[color:var(--text-secondary)]">
        You do not have permission to run Aria autoprep for this matter.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.9rem] bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.22),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_70px_rgba(88,28,135,0.18)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info">Automation</StatusPill>
              <StatusPill tone={result?.safety.readyForAgentFinalReview ? "success" : "warning"}>
                {result?.safety.readyForAgentFinalReview ? "Agent final review ready" : "Prep in progress"}
              </StatusPill>
              {result ? <StatusPill tone="info">{enabledApprovalCount} approvals available</StatusPill> : null}
            </div>
            <p className="mt-4 text-lg font-semibold text-[color:var(--text-primary)]">Aria autoprep agent</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
              Aria can run low-risk prep work itself, assemble the evidence picture, and tee up client-facing or higher-impact actions for explicit approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GradientButton type="button" onClick={() => run()} disabled={pending}>
              Run Aria autoprep
            </GradientButton>
            <SubtleButton type="button" onClick={() => run(selectedActions)} disabled={pending || !selectedActions.length}>
              Run approved batch
            </SubtleButton>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-[1.35rem] bg-white/[0.05] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Safety gate</p>
            <p className="mt-2 text-sm font-medium text-[color:var(--text-primary)]">
              {result ? (result.safety.readyForAgentFinalReview ? "Ready for final review" : `${result.safety.hardBlockers.length} hard blocker(s)`) : "Run autoprep"}
            </p>
          </div>
          <div className="rounded-[1.35rem] bg-white/[0.05] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Mapped templates</p>
            <p className="mt-2 text-sm font-medium text-[color:var(--text-primary)]">{result?.mappedTemplateCount ?? "-"}</p>
          </div>
          <div className="rounded-[1.35rem] bg-white/[0.05] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Missing checklist</p>
            <p className="mt-2 text-sm font-medium text-[color:var(--text-primary)]">{result?.missingChecklistCount ?? "-"}</p>
          </div>
          <div className="rounded-[1.35rem] bg-white/[0.05] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Client confirmations</p>
            <p className="mt-2 text-sm font-medium text-[color:var(--text-primary)]">{result?.clientConfirmations.length ?? "-"}</p>
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-[color:var(--text-secondary)]">{message}</p> : null}
      </div>

      {result ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            <div className="rounded-[1.6rem] bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">Aria completed automatically</p>
                <StatusPill tone="success">{result.executedActions.length} action(s)</StatusPill>
              </div>
              <div className="mt-3 space-y-2">
                {result.executedActions.map((action) => (
                  <div key={action.key} className="rounded-[1.15rem] bg-white/[0.04] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[color:var(--text-primary)]">{action.label}</p>
                      <StatusPill tone={toneForStatus(action.status)}>{action.status}</StatusPill>
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--text-secondary)]">{action.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">Approval-required actions</p>
                <StatusPill tone="info">{enabledApprovalCount} enabled</StatusPill>
              </div>
              <div className="mt-3 space-y-3">
                {result.approvalCandidates.map((action) => (
                  <label key={action.key} className={`flex items-start gap-3 rounded-[1.15rem] p-3 ${action.enabled ? "bg-white/[0.04]" : "bg-white/[0.02] opacity-70"}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[action.key])}
                      disabled={!action.enabled || pending}
                      onChange={(event) => setSelected((current) => ({ ...current, [action.key]: event.target.checked }))}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-violet-400"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[color:var(--text-primary)]">{action.label}</p>
                        <StatusPill tone={action.enabled ? "warning" : "neutral"}>{action.enabled ? "Ready for approval" : "Unavailable"}</StatusPill>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{action.description}</p>
                      <p className="mt-2 text-xs text-[color:var(--text-tertiary)]">{action.reason}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {result.approvedResults.length ? (
              <div className="rounded-[1.6rem] bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">Approved batch results</p>
                <div className="mt-3 space-y-2">
                  {result.approvedResults.map((action) => (
                    <div key={`${action.key}-${action.label}`} className="rounded-[1.15rem] bg-white/[0.04] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[color:var(--text-primary)]">{action.label}</p>
                        <StatusPill tone={toneForStatus(action.status)}>{action.status}</StatusPill>
                      </div>
                      <p className="mt-2 text-xs text-[color:var(--text-secondary)]">{action.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.6rem] bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">Client confirmation pack</p>
                <StatusPill tone={result.clientConfirmations.some((item) => item.status === "required") ? "warning" : "info"}>
                  {result.clientConfirmations.length ? `${result.clientConfirmations.length} queued` : "None"}
                </StatusPill>
              </div>
              <div className="mt-3 space-y-2">
                {result.clientConfirmations.length ? result.clientConfirmations.map((item) => (
                  <div key={item.key} className="rounded-[1.15rem] bg-white/[0.04] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[color:var(--text-primary)]">{item.title}</p>
                      <StatusPill tone={item.status === "required" ? "danger" : "warning"}>{item.status}</StatusPill>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--text-secondary)]">{item.detail}</p>
                  </div>
                )) : (
                  <p className="rounded-[1.15rem] bg-white/[0.04] p-3 text-sm text-[color:var(--text-secondary)]">
                    No client confirmation items are currently visible from the blockers and missing fields.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[1.6rem] bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">Draft briefing</p>
              {result.draftBriefing ? (
                <>
                  <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-secondary)]">
                    {result.draftBriefing.summary.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <div className="mt-4 space-y-3">
                    {result.draftBriefing.criticalIssues.length ? (
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Critical issues</p>
                        <div className="mt-2 space-y-2">
                          {result.draftBriefing.criticalIssues.map((issue) => (
                            <div key={issue.title} className="rounded-[1.1rem] bg-amber-500/10 p-3">
                              <p className="text-sm font-medium text-amber-200">{issue.title}</p>
                              <p className="mt-1 text-xs text-amber-100/80">{issue.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {result.draftBriefing.missingFields.length ? (
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Fields still needing attention</p>
                        <div className="mt-2 space-y-2">
                          {result.draftBriefing.missingFields.slice(0, 6).map((field) => (
                            <div key={field.label} className="rounded-[1.1rem] bg-white/[0.04] p-3">
                              <p className="text-sm font-medium text-[color:var(--text-primary)]">{field.label}</p>
                              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{field.status}{field.source ? ` - source ${field.source}` : ""}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-[color:var(--text-secondary)]">No draft briefing is available for this matter yet.</p>
              )}
            </div>

            <div className="rounded-[1.6rem] bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">Safety blockers</p>
              <div className="mt-3 space-y-2">
                {result.safety.hardBlockers.length ? result.safety.hardBlockers.map((blocker) => (
                  <div key={blocker.title} className="rounded-[1.1rem] bg-red-500/10 p-3">
                    <p className="text-sm font-medium text-red-200">{blocker.title}</p>
                    {blocker.detail ? <p className="mt-1 text-xs text-red-100/80">{blocker.detail}</p> : null}
                  </div>
                )) : <p className="rounded-[1.1rem] bg-emerald-500/10 p-3 text-sm text-emerald-200">No hard blockers remain.</p>}
                {result.safety.softBlockers.map((blocker) => (
                  <div key={blocker.title} className="rounded-[1.1rem] bg-white/[0.04] p-3">
                    <p className="text-sm font-medium text-[color:var(--text-primary)]">{blocker.title}</p>
                    {blocker.detail ? <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{blocker.detail}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
