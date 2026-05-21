import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

type PortalShellProps = {
  firmName?: string | null;
  clientName?: string;
  matterTitle?: string;
  subclass?: string;
  children: ReactNode;
};

export function PortalShell({ firmName, clientName, matterTitle, subclass, children }: PortalShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_30%),linear-gradient(135deg,#07111F,#10233F_48%,#182033)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                  Secure client portal
                </span>
                <span className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1 text-xs font-semibold text-violet-100">
                  Agent review required
                </span>
              </div>
              <p className="mt-4 text-sm font-medium text-cyan-100">{firmName || "Your migration team"}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{clientName || "Client portal"}</h1>
              {matterTitle ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {matterTitle}{subclass ? ` · Subclass ${subclass}` : ""}
                </p>
              ) : null}
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm leading-6 text-slate-200 lg:max-w-sm">
              Your migration agent will review all information before it is used. Aria does not lodge applications or guarantee visa outcomes.
            </div>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function PortalCard({ children, className = "", ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={`rounded-[1.5rem] border border-white/10 bg-white/[0.08] p-5 shadow-xl shadow-slate-950/20 backdrop-blur-xl ${className}`.trim()}>
      {children}
    </section>
  );
}

export function PortalSectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">{eyebrow}</p> : null}
      <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p> : null}
    </div>
  );
}

export type PortalStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export function PortalStatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: PortalStatusTone }) {
  const tones: Record<PortalStatusTone, string> = {
    neutral: "border-white/12 bg-white/[0.08] text-slate-200",
    info: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    warning: "border-amber-300/30 bg-amber-300/12 text-amber-100",
    danger: "border-rose-300/30 bg-rose-300/12 text-rose-100"
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PortalActionLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href as any} className="group block rounded-3xl border border-white/10 bg-white/[0.06] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.10] focus:outline-none focus:ring-2 focus:ring-cyan-300/50">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-400 group-hover:text-slate-300">{description}</p>
    </Link>
  );
}

export function formatPortalStatus(value?: string | null) {
  if (!value) return "Not started";
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function dueLabel(date?: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function documentStatus(item: {
  documentId: string | null;
  reviewedAt: Date | null;
  status: string;
  required: boolean;
  document?: { reviewStatus: string; extractionStatus: string } | null;
}) {
  if (!item.required && !item.documentId) return { label: "Optional", tone: "neutral" as const };
  if (!item.documentId) return { label: item.status === "REQUESTED" ? "Awaiting upload" : "Missing", tone: "warning" as const };
  if (item.document?.reviewStatus === "VERIFIED" || item.reviewedAt) return { label: "Accepted / Approved by team", tone: "success" as const };
  if (item.document?.reviewStatus === "FLAGGED") return { label: "Needs clearer copy", tone: "danger" as const };
  if (item.document?.extractionStatus === "NEEDS_REVIEW") return { label: "Under review", tone: "warning" as const };
  return { label: "Uploaded", tone: "info" as const };
}
