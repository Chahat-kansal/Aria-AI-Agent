import { cn } from "@/lib/utils";

export function PageSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-5", className)}>
      {(eyebrow || title || description || action) ? (
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {eyebrow ? <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-[color:var(--text-faint)]">{eyebrow}</p> : null}
            {title ? <h2 className="text-xl font-semibold tracking-tight text-[color:var(--text-strong)] md:text-2xl">{title}</h2> : null}
            {description ? <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
