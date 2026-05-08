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
    <div className="app-surface-strong relative overflow-hidden rounded-[2rem] p-6 backdrop-blur-xl">
      <div className="absolute inset-x-20 top-0 h-28 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.18),transparent_72%)] blur-3xl" />
      <p className="relative text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">{title}</p>
      <p className="relative mt-4 max-w-3xl text-lg font-medium leading-8 text-[color:var(--text-strong)]">{summary}</p>
      {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
