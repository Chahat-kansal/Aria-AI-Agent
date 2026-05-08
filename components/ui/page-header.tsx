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
        {eyebrow ? <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-tertiary)]">{eyebrow}</p> : null}
        <h1 className="page-title-display text-[2.35rem] leading-[0.95] text-[color:var(--text-primary)] md:text-[3rem]">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-[0.98rem] leading-7 text-[color:var(--text-secondary)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
