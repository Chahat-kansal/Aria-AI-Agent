import Link from "next/link";
import { ArrowRight, CheckCircle2, Files, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { AppPage } from "@/components/ui/app-page";
import { Card } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <AppPage contentClassName="space-y-6 py-8 sm:py-10">
      <header className="aria-surface-strong rounded-[2rem] px-6 py-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--accent)]">Aria for Migration Agents</p>
            <p className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">
              AI-assisted migration operations platform
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/auth/sign-in" className="inline-flex h-10 items-center justify-center rounded-[1.35rem] bg-[color:var(--surface-soft)] px-4 text-sm font-medium text-[color:var(--text-primary)] shadow-[var(--shadow-sm)] transition hover:-translate-y-[1px]">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="app-purple-glow inline-flex h-11 items-center justify-center rounded-[1.35rem] bg-gradient-to-r from-[#6f31ef] via-[#8c56ff] to-[#7a3ff2] px-6 text-sm font-semibold text-white transition hover:scale-[1.01] hover:opacity-95">
              Start workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[2.25rem] bg-[radial-gradient(circle_at_25%_45%,rgba(124,58,237,0.14),transparent_38%),radial-gradient(circle_at_85%_20%,rgba(96,165,250,0.08),transparent_28%),linear-gradient(135deg,var(--surface-strong),var(--surface-soft))] px-6 py-14 shadow-[var(--shadow-lg)] sm:px-10 sm:py-20">
        <div className="relative mx-auto max-w-5xl">
          <div className="inline-flex rounded-full bg-[color:var(--surface-soft)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.3em] text-[color:var(--accent)] shadow-[var(--shadow-sm)]">
            AI-assisted - Source-linked - Review required
          </div>
          <h1 className="page-title-display mt-8 max-w-4xl text-5xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-7xl">
            Experience next-level migration.
          </h1>
          <p className="mt-6 max-w-3xl text-2xl italic leading-10 text-[color:var(--text-secondary)] sm:text-4xl">
            Minimal effort. Maximum impact. Built for modern teams.
          </p>
          <p className="mt-8 max-w-3xl text-base leading-8 text-[color:var(--text-secondary)]">
            Aria helps registered migration practices manage matters, organize evidence, review source-linked draft fields, monitor official changes, and prepare submissions with a clear review trail.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/auth/sign-up" className="app-purple-glow inline-flex h-11 items-center justify-center rounded-[1.35rem] bg-gradient-to-r from-[#6f31ef] via-[#8c56ff] to-[#7a3ff2] px-7 text-sm font-semibold text-white transition hover:scale-[1.01] hover:opacity-95">
              Sign up free
            </Link>
            <Link href="#workflow" className="inline-flex h-11 items-center justify-center rounded-[1.35rem] bg-[color:var(--surface-soft)] px-7 text-sm font-medium text-[color:var(--text-primary)] shadow-[var(--shadow-sm)] transition hover:-translate-y-[1px]">
              How it works
            </Link>
          </div>
        </div>
      </section>

      <section id="workflow" className="grid gap-5 md:grid-cols-3">
        {[
          { title: "Matter operations", icon: Files, description: "Track status, readiness, deadlines, evidence, and team ownership across every active file." },
          { title: "Field review", icon: Sparkles, description: "Review AI-assisted draft fields with source snippets, confidence, and flagged inconsistencies." },
          { title: "Official update monitoring", icon: Radar, description: "Store official changes, map likely matter impacts, and prioritize review before client advice." }
        ].map((item) => (
          <Card key={item.title} className="h-full">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[color:var(--violet-soft)] text-[color:var(--accent)]">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-[color:var(--text-primary)]">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{item.description}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <h2 className="text-xl font-semibold tracking-tight text-[color:var(--text-primary)]">How Aria improves operational quality</h2>
          <ul className="mt-5 space-y-3 text-sm text-[color:var(--text-secondary)]">
            {[
              "Standardize document intake and evidence collection.",
              "Keep draft fields source-linked and reviewable.",
              "Catch validation blockers before final review.",
              "Coordinate team actions with tasks, timelines, and audit trails."
            ].map((item) => (
              <li key={item} className="flex gap-3 rounded-[1.4rem] bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-sm)]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex h-full flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[color:var(--text-primary)]">Security and trust posture</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">
              Workspace boundaries, role-aware permissions, source-linked AI outputs, and explicit review-required workflows support responsible migration practice operations.
            </p>
          </div>
          <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-[1rem] bg-[color:var(--violet-soft)] text-[color:var(--accent)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </Card>
      </section>
    </AppPage>
  );
}
