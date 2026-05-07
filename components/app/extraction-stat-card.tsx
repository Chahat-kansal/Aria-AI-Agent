import { cn } from "@/lib/utils";

export function ExtractionStatCard({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.35rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        tone === "good" && "border-emerald-400/20 bg-emerald-400/[0.06]",
        tone === "warn" && "border-amber-400/20 bg-amber-400/[0.06]",
        tone === "danger" && "border-rose-400/20 bg-rose-400/[0.06]",
        tone === "neutral" && "border-white/8 bg-white/[0.035]"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{hint}</p>
    </div>
  );
}
