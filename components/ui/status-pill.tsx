export function StatusPill({
  tone = "neutral",
  children
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "border-white/10 bg-white/5 text-slate-300",
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    danger: "border-red-400/20 bg-red-400/10 text-red-300",
    info: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${styles[tone]}`}>
      {children}
    </span>
  );
}
