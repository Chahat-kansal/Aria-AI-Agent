"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubtleButton } from "@/components/ui/subtle-button";
import type { ExtractionReviewFlag } from "@/lib/services/extraction-review";

const toneMap = {
  info: {
    wrap: "border-cyan-400/20 bg-cyan-400/[0.08]",
    text: "text-cyan-100",
    sub: "text-cyan-200/80",
    icon: Info
  },
  warning: {
    wrap: "border-amber-400/20 bg-amber-400/[0.08]",
    text: "text-amber-100",
    sub: "text-amber-200/80",
    icon: AlertTriangle
  },
  critical: {
    wrap: "border-rose-400/20 bg-rose-400/[0.08]",
    text: "text-rose-100",
    sub: "text-rose-200/80",
    icon: ShieldAlert
  }
} as const;

export function ExtractionAlert({ flag }: { flag: ExtractionReviewFlag }) {
  const tone = toneMap[flag.severity];
  const Icon = tone.icon;

  return (
    <div className={cn("rounded-[1.35rem] border p-4", tone.wrap)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-white/10 bg-black/20 p-2">
          <Icon className={cn("h-4 w-4", tone.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={cn("text-sm font-semibold", tone.text)}>{flag.title}</p>
              <p className={cn("mt-1 text-sm leading-6", tone.sub)}>{flag.reason}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80">
              {flag.severity}
            </span>
          </div>

          <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Evidence source</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{flag.evidence}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {flag.href ? (
              <Link href={flag.href as any}>
                <SubtleButton className="h-9 px-3">Open review</SubtleButton>
              </Link>
            ) : null}
            <button
              disabled={!flag.reviewEnabled}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-[1rem] border px-3 text-sm font-medium transition",
                flag.reviewEnabled
                  ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-100 hover:bg-emerald-400/18"
                  : "cursor-not-allowed border-white/10 bg-white/[0.04] text-slate-500"
              )}
              title={flag.reviewReason ?? undefined}
            >
              {flag.reviewEnabled ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark reviewed
                </>
              ) : (
                "Mark reviewed unavailable"
              )}
            </button>
          </div>
          {!flag.reviewEnabled && flag.reviewReason ? <p className="mt-2 text-xs text-slate-500">{flag.reviewReason}</p> : null}
          <p className="mt-3 text-xs text-slate-400">Recommended staff action: {flag.recommendedAction}</p>
        </div>
      </div>
    </div>
  );
}
