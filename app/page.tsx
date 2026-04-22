import Link from "next/link";
import { ShieldCheck, Sparkles, Files, Radar, CheckCircle2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050B17] to-[#03060D] px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria for Migration Agents</p>
            <h1 className="text-3xl font-semibold">AI-assisted migration operations for registered migration practices.</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/auth/sign-in"><Button className="border border-border bg-transparent">Sign in</Button></Link>
            <Link href="/app/overview"><Button>Start trial</Button></Link>
          </div>
        </header>

        <section className="panel p-10">
          <Badge className="border-accent/40 bg-accent/10 text-accent">AI-assisted · Source-linked · Review required</Badge>
          <h2 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight">Reduce manual administration while improving submission readiness.</h2>
          <p className="mt-4 max-w-2xl text-muted">Aria helps migration teams manage matters, organize evidence, review extracted draft fields, validate inconsistencies, monitor official changes, and identify potentially affected client files.</p>
          <div className="mt-6 flex gap-3"><Button>Book demo</Button><Button className="border border-border bg-transparent">See pricing</Button></div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[{t:"Matter Operations",i:Files,d:"Track stages, status, ownership, and readiness across every active matter."},{t:"Field Review",i:Sparkles,d:"Review extracted draft fields with confidence scoring and source snippets."},{t:"Official Update Monitoring",i:Radar,d:"Monitor trusted sources and map impact across in-flight matters."}].map((item) => (
            <Card key={item.t}><item.i className="mb-3 h-5 w-5 text-accent"/><h3 className="font-semibold">{item.t}</h3><p className="mt-2 text-sm text-muted">{item.d}</p></Card>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="font-semibold">How Aria improves operational quality</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {[
                "Standardize document intake and folder structures.",
                "Catch flagged inconsistencies before final review.",
                "Keep form draft fields source-linked and verifiable.",
                "Coordinate team actions with tasks and audit trails."
              ].map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success"/>{x}</li>)}
            </ul>
          </Card>
          <Card>
            <h3 className="font-semibold">Security & trust posture</h3>
            <p className="mt-3 text-sm text-muted">Workspace boundaries, role-aware access foundations, source-linked outputs, and explicit review-required workflows support responsible practice operations.</p>
            <ShieldCheck className="mt-4 h-6 w-6 text-accent"/>
          </Card>
        </section>

        <section className="panel p-8">
          <h3 className="text-xl font-semibold">Pricing</h3>
          <p className="mt-1 text-sm text-muted">Designed for solo agents through multi-user firms.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[{tier:"Starter",price:"A$99",desc:"For solo agents and lean operations."},{tier:"Growth",price:"A$299",desc:"For active firms with larger matter volume."},{tier:"Pro",price:"A$699",desc:"For teams needing advanced workflow depth."}].map((p)=><Card key={p.tier} className="bg-[#0a1221]"><h4 className="font-semibold">{p.tier}</h4><p className="mt-1 text-sm text-muted">{p.desc}</p><p className="mt-4 text-2xl font-semibold">{p.price}<span className="text-sm text-muted">/mo</span></p><button className="mt-3 inline-flex items-center gap-1 text-sm text-accent">Start trial <ArrowRight className="h-4 w-4"/></button></Card>)}
          </div>
        </section>
      </div>
    </div>
  );
}
