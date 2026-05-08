export function StatusPill({
  tone = "neutral",
  children
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] shadow-[var(--shadow-sm)]",
    success: "bg-emerald-400/12 text-emerald-500 shadow-[var(--shadow-sm)] dark:text-emerald-300",
    warning: "bg-amber-400/12 text-amber-500 shadow-[var(--shadow-sm)] dark:text-amber-300",
    danger: "bg-rose-400/12 text-rose-500 shadow-[var(--shadow-sm)] dark:text-rose-300",
    info: "bg-violet-400/12 text-violet-600 shadow-[var(--shadow-sm)] dark:text-violet-300"
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] ${styles[tone]}`}>
      {children}
    </span>
  );
}
