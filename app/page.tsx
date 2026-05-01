import Link from "next/link";
import { ArrowRight, CheckCircle2, Files, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { AppPage } from "@/components/ui/app-page";
import { Card } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <AppPage contentClassName="space-y-6 py-8 sm:py-10">
      <header className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,22,0.94),rgba(9,15,22,0.82))] px-6 py-5 shadow-glass backdrop-blur-xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300">Aria for Migration Agents</p>
            <p className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              AI-assisted migration operations platform
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/auth/sign-in" className="inline-flex h-10 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="inline-flex h-11 items-center justify-center rounded-[1.35rem] bg-gradient-to-r from-violet-500 via-violet-400 to-cyan-400 px-6 text-sm font-semibold text-slate-950 shadow-[0_14px_48px_rgba(34,211,238,0.22)] transition hover:scale-[1.01] hover:opacity-95">
              Start workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/8 bg-[linear-gradient(115deg,rgba(16,14,26,0.96),rgba(7,15,23,0.88))] px-6 py-14 shadow-[0_30px_100px_rgba(0,0,0,0.36)] sm:px-10 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_45%,rgba(124,58,237,0.24),transparent_38%),radial-gradient(circle_at_85%_20%,rgba(34,211,238,0.14),transparent_28%)]" />
        <div className="relative mx-auto max-w-5xl">
          <div className="inline-flex rounded-full border border-cyan-400/15 bg-white/[0.03] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-200">
            AI-assisted - Source-linked - Review required
          </div>
          <h1 className="mt-8 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">
            Experience next-level migration.
          </h1>
          <p className="mt-6 max-w-3xl text-2xl italic leading-10 text-slate-300 sm:text-4xl">
            Minimal effort. Maximum impact. Built for modern teams.
          </p>
          <p className="mt-8 max-w-3xl text-base leading-8 text-slate-400">
            Aria helps registered migration practices manage matters, organize evidence, review source-linked draft fields, monitor official changes, and prepare submissions with a clear review trail.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/auth/sign-up" className="inline-flex h-11 items-center justify-center rounded-[1.35rem] bg-gradient-to-r from-violet-500 via-violet-400 to-cyan-400 px-7 text-sm font-semibold text-slate-950 shadow-[0_14px_48px_rgba(34,211,238,0.22)] transition hover:scale-[1.01] hover:opacity-95">
              Sign up free
            </Link>
            <Link href="#workflow" className="inline-flex h-11 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-7 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">
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
            <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-cyan-400/10 text-cyan-300">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <h2 className="text-xl font-semibold tracking-tight text-white">How Aria improves operational quality</h2>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            {[
              "Standardize document intake and evidence collection.",
              "Keep draft fields source-linked and reviewable.",
              "Catch validation blockers before final review.",
              "Coordinate team actions with tasks, timelines, and audit trails."
            ].map((item) => (
              <li key={item} className="flex gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex h-full flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">Security and trust posture</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Workspace boundaries, role-aware permissions, source-linked AI outputs, and explicit review-required workflows support responsible migration practice operations.
            </p>
          </div>
          <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-[1rem] bg-violet-500/10 text-violet-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </Card>
      </section>
    </AppPage>
  );
}
