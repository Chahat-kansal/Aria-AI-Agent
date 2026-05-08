import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/ui/status-pill";

export function AIInsightPanel({
  eyebrow = "Aria - Daily Briefing",
  title,
  summary,
  statusLabel,
  action,
  children,
  className
}: {
  eyebrow?: string;
  title: string;
  summary: string;
  statusLabel?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "app-surface-strong relative overflow-hidden rounded-[2.25rem] p-7",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.18),transparent_62%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="themed-logo-mark flex h-12 w-12 items-center justify-center rounded-[1.1rem] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">{eyebrow}</p>
              <h2 className="page-title-display mt-2 max-w-2xl text-[2.6rem] leading-none text-[color:var(--text-strong)] sm:text-[3.5rem]">{title}</h2>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[color:var(--text-muted)]">{summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {statusLabel ? <StatusPill tone="info">{statusLabel}</StatusPill> : null}
          {action}
        </div>
      </div>
      {children ? <div className="relative mt-6">{children}</div> : null}
    </section>
  );
}
