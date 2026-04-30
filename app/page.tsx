import Link from "next/link";
import { ArrowRight, CheckCircle2, Files, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#08111F_0%,#0D1B2E_45%,#111827_100%)] text-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-5 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Aria for Migration Agents</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">AI-assisted migration operations platform</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/auth/sign-in" className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 hover:bg-white/10">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95">
              Start workspace
            </Link>
          </div>
        </header>

        <section className="relative overflow-hidden px-2 py-20 text-center sm:px-6">
          <div className="absolute inset-x-0 top-12 h-72 bg-[radial-gradient(circle,rgba(124,58,237,0.22),transparent_55%)] blur-3xl" />
          <div className="relative mx-auto max-w-5xl">
            <p className="mx-auto inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-200">
              AI-assisted · Source-linked · Review required
            </p>
            <h2 className="mt-8 text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              Experience next-level migration.
            </h2>
            <p className="mx-auto mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-400 sm:text-5xl">
              Minimal effort. Maximum impact. Built for modern teams.
            </p>
            <p className="mx-auto mt-8 max-w-2xl text-sm leading-7 text-slate-300">
              Aria helps registered migration practices manage matters, organize evidence, review source-linked draft fields, monitor official changes, and prepare submissions with a clear review trail.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/auth/sign-up" className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-6 text-sm font-semibold text-slate-950 transition hover:scale-[1.01]">
                Sign up free
              </Link>
              <Link href="#workflow" className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-sm font-medium text-slate-100 hover:bg-white/10">
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
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p>
            </Card>
          ))}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">How Aria improves operational quality</h3>
            <ul className="mt-5 space-y-3 text-sm text-slate-300">
              {[
                "Standardize document intake and evidence collection.",
                "Keep draft fields source-linked and reviewable.",
                "Catch validation blockers before final review.",
                "Coordinate team actions with tasks, timelines, and audit trails."
              ].map((item) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="flex h-full flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-white">Security and trust posture</h3>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Workspace boundaries, role-aware permissions, source-linked AI outputs, and explicit review-required workflows support responsible migration practice operations.
              </p>
            </div>
            <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </Card>
        </section>

        <section id="pricing" className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
          <h3 className="text-xl font-semibold tracking-tight text-white">Pricing</h3>
          <p className="mt-2 text-sm text-slate-400">Designed for solo agents through multi-user firms.</p>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[
              { tier: "Starter", price: "A$99", description: "For solo agents and lean operations." },
              { tier: "Growth", price: "A$299", description: "For active firms with larger matter volume." },
              { tier: "Pro", price: "A$699", description: "For teams needing advanced workflow depth." }
            ].map((plan) => (
              <Card key={plan.tier} className="bg-white/[0.04]">
                <h4 className="text-lg font-semibold text-white">{plan.tier}</h4>
                <p className="mt-2 text-sm text-slate-400">{plan.description}</p>
                <p className="mt-6 text-3xl font-semibold text-white">
                  {plan.price}
                  <span className="ml-1 text-sm font-normal text-slate-400">/mo</span>
                </p>
                <button className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200">
                  Start trial
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
