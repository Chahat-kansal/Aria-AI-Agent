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
    <div className={className ?? "flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"}>
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-tertiary)]">{eyebrow}</p> : null}
        <h1 className="page-title-display text-[2rem] leading-[0.98] text-[color:var(--text-primary)] sm:text-[2.4rem] lg:text-[2.85rem]">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-[0.98rem] leading-7 text-[color:var(--text-secondary)]">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{action}</div> : null}
    </div>
  );
}
