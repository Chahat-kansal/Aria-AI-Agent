export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "flex flex-col gap-4 md:flex-row md:items-end md:justify-between"}>
      <div>
        {eyebrow ? <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
