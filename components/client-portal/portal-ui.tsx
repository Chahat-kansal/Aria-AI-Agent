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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.10),transparent_30%),linear-gradient(180deg,#fbfaff,#f4f7fb)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(79,70,229,0.12)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                Secure client portal
              </span>
              <p className="mt-4 text-sm font-medium text-violet-700">{firmName || "Your migration team"}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{clientName || "Client portal"}</h1>
              {matterTitle ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {matterTitle}{subclass ? ` - Subclass ${subclass}` : ""}
                </p>
              ) : null}
            </div>
            <div className="rounded-3xl border border-violet-100 bg-violet-50 p-4 text-sm leading-6 text-slate-700 lg:max-w-sm">
              Your migration team will review everything before it is used.
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
    <section {...props} className={`rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ${className}`.trim()}>
      {children}
    </section>
  );
}

export function PortalSectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">{eyebrow}</p> : null}
      <h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}

export type PortalStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export function PortalStatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: PortalStatusTone }) {
  const tones: Record<PortalStatusTone, string> = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    info: "border-cyan-200 bg-cyan-50 text-cyan-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-800"
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PortalActionLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href as any} className="group block rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-300/50">
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
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

export function cleanClientDescription(value?: string | null) {
  if (!value) return null;
  if (/demo checklist item|not official legal advice|ai working copy|evidence vault|audit metadata/i.test(value)) return null;
  return value;
}

export function documentStatus(item: {
  documentId: string | null;
  reviewedAt: Date | null;
  status: string;
  required: boolean;
  document?: { reviewStatus: string; extractionStatus: string } | null;
}) {
  if (!item.required && !item.documentId) return { label: "Optional", tone: "neutral" as const };
  if (!item.documentId) return { label: "Missing", tone: "warning" as const };
  if (item.document?.reviewStatus === "VERIFIED" || item.reviewedAt) return { label: "Accepted", tone: "success" as const };
  if (item.document?.reviewStatus === "FLAGGED") return { label: "Needs clearer copy", tone: "danger" as const };
  if (item.document?.extractionStatus === "NEEDS_REVIEW") return { label: "Under review", tone: "warning" as const };
  return { label: "Uploaded", tone: "info" as const };
}

