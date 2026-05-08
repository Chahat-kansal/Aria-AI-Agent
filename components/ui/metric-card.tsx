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
      ? "from-emerald-400/12"
      : accent === "amber"
        ? "from-amber-400/12"
        : accent === "red"
          ? "from-red-400/12"
          : accent === "violet"
            ? "from-violet-400/16"
            : "from-violet-300/14";

  return (
    <div
      className={cn(
        "app-surface relative overflow-hidden rounded-[18px] bg-gradient-to-br via-transparent to-transparent p-6",
        accentClass,
        className
      )}
    >
      <div className="pointer-events-none absolute right-[-46px] top-[-46px] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.18),transparent_70%)] blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">{label}</p>
          <p className="mt-4 font-mono text-[2rem] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">{value}</p>
          {hint ? <p className="mt-3 text-sm text-[color:var(--text-secondary)]">{hint}</p> : null}
        </div>
        {icon ? <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,var(--violet-dim),rgba(255,255,255,0.02))] text-[color:var(--violet)] shadow-[var(--shadow-sm)]">{icon}</div> : null}
      </div>
    </div>
  );
}
