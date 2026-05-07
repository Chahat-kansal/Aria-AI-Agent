"use client";

import { cn } from "@/lib/utils";
import type { ExtractionReliability } from "@/lib/services/extraction-review";

const toneMap: Record<ExtractionReliability, string> = {
  OFFICIAL: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  CLIENT_SUPPLIED: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
  AGENT_ENTERED: "border-violet-400/30 bg-violet-400/10 text-violet-100",
  AI_EXTRACTED: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  SYSTEM_DERIVED: "border-white/12 bg-white/[0.06] text-slate-200"
};

export function ExtractionSourceBadge({
  reliability,
  className
}: {
  reliability: ExtractionReliability;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
        toneMap[reliability],
        className
      )}
    >
      {reliability.replaceAll("_", " ")}
    </span>
  );
}
