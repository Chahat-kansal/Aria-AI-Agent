"use client";

import { ExtractionSourceBadge } from "@/components/app/extraction-source-badge";
import { StatusPill } from "@/components/ui/status-pill";
import type { ExtractionReviewPerson } from "@/lib/services/extraction-review";

export function ExtractionPersonCard({
  person,
  active,
  onSelect
}: {
  person: ExtractionReviewPerson;
  active?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
        active
          ? "border-cyan-400/35 bg-cyan-400/[0.08] shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
          : "border-white/8 bg-white/[0.035] hover:bg-white/[0.055]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{person.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{person.role}</p>
        </div>
        <StatusPill tone={person.flagCount ? "warning" : "success"}>{person.status}</StatusPill>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <ExtractionSourceBadge reliability="CLIENT_SUPPLIED" />
        <p className="text-xs text-slate-400">{person.flagCount} flag(s)</p>
      </div>
    </button>
  );
}
