import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  accent,
  icon,
  className
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "cyan" | "violet" | "emerald" | "amber" | "red";
  icon?: React.ReactNode;
  className?: string;
}) {
  const accentClass =
    accent === "emerald"
      ? "from-emerald-400/10"
      : accent === "amber"
        ? "from-amber-400/10"
        : accent === "red"
          ? "from-red-400/10"
          : accent === "violet"
            ? "from-violet-400/12"
            : "from-cyan-400/10";

  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-white/8 bg-gradient-to-br to-slate-950/70 p-5 shadow-glass backdrop-blur-xl",
        accentClass,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">{label}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-white">{value}</p>
          {hint ? <p className="mt-2 text-sm text-slate-400">{hint}</p> : null}
        </div>
        {icon ? <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-cyan-300">{icon}</div> : null}
      </div>
    </div>
  );
}
