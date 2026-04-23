export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#172033] md:text-3xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{subtitle}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
