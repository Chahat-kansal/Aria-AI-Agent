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
        "relative overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(120deg,rgba(19,20,27,0.98),rgba(10,28,31,0.92))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.14),transparent_62%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-violet-400/70 to-cyan-400/30 text-white shadow-glow">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</p>
              <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">{summary}</p>
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
