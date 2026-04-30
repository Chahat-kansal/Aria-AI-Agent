export function AIInsightCard({
  title = "Aria Intelligence",
  summary,
  actions
}: {
  title?: string;
  summary: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/12 via-violet-500/12 to-slate-950/70 p-6 shadow-cyanGlow backdrop-blur-xl">
      <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">{title}</p>
      <p className="mt-4 max-w-3xl text-lg font-medium leading-8 text-white">{summary}</p>
      {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
