import { evidenceLabel, type AriaEvidenceReliability } from "@/lib/services/aria-evidence";

function toneClasses(reliability: AriaEvidenceReliability) {
  switch (reliability) {
    case "OFFICIAL":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
    case "NEWS_INTEL":
      return "border-amber-400/20 bg-amber-400/10 text-amber-200";
    case "CLIENT_SUPPLIED":
      return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
    case "AGENT_ENTERED":
      return "border-violet-400/20 bg-violet-400/10 text-violet-200";
    case "AI_EXTRACTED":
      return "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200";
    case "SYSTEM_DERIVED":
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300";
  }
}

export function SourceReliabilityBadge({
  reliability,
  className = ""
}: {
  reliability: AriaEvidenceReliability;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${toneClasses(reliability)} ${className}`}>
      {evidenceLabel(reliability)}
    </span>
  );
}
