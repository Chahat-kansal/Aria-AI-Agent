export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="app-surface rounded-[18px] p-10 text-center">
      <h3 className="page-title-display text-[2rem] text-[color:var(--text-primary)]">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[color:var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
