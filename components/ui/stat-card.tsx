export function StatCard({
  label,
  value,
  hint,
  tone = "info"
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  const glow = {
    info: "from-cyan-400/20",
    success: "from-emerald-400/20",
    warning: "from-amber-400/20",
    danger: "from-red-400/20"
  };

  return (
    <div className={`rounded-3xl border border-white/10 bg-gradient-to-br ${glow[tone]} to-slate-950/60 p-5 shadow-glass backdrop-blur-xl`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
