import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getOverview } from "@/lib/data/demo-repository";

const tabs = ["Overview", "Documents", "Field Review", "Validation", "Tasks", "Updates", "AI Assistant"];

export default function MatterDetailPage({ params }: { params: { matterId: string } }) {
  const { matters, documents, issues, impacts, tasks } = getOverview();
  const matter = matters.find((m) => m.id === params.matterId) ?? matters[0];

  return (
    <AppShell title="Matters">
      <PageHeader title={`${matter.client} · ${matter.title}`} subtitle="AI-assisted matter workspace with source-linked review controls." />
      <Card>
        <div className="flex flex-wrap gap-2 text-sm">{tabs.map((tab, idx) => <span key={tab} className={`rounded-full px-3 py-1 ${idx === 0 ? "bg-accent/20 text-accent" : "bg-[#111a2b] text-muted"}`}>{tab}</span>)}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
          <div className="rounded-xl border border-border p-3"><p className="text-muted">Status</p><p className="font-medium">{matter.status}</p></div>
          <div className="rounded-xl border border-border p-3"><p className="text-muted">Stage</p><p className="font-medium">{matter.stage}</p></div>
          <div className="rounded-xl border border-border p-3"><p className="text-muted">Readiness</p><p className="font-medium">{matter.readiness}%</p></div>
          <div className="rounded-xl border border-border p-3"><p className="text-muted">Lodgement target</p><p className="font-medium">2026-06-14</p></div>
        </div>
      </Card>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Checklist summary</h3>
          <ul className="mt-3 list-disc pl-5 text-sm text-muted">
            <li>Identity evidence: complete</li>
            <li>Employment evidence: review required</li>
            <li>Health / police bundle: pending</li>
            <li>Field verification: in progress</li>
          </ul>
        </Card>
        <Card>
          <h3 className="font-semibold">Flagged issues</h3>
          <ul className="mt-3 list-disc pl-5 text-sm text-muted">{issues.filter((x)=>x.matterId===matter.id).slice(0,4).map((i) => <li key={i.id}>{i.title}</li>)}</ul>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <Card><h3 className="font-semibold">Documents</h3><p className="mt-2 text-sm text-muted">{documents.filter((d) => d.matterId === matter.id).length} linked files</p></Card>
        <Card><h3 className="font-semibold">Potential impacts</h3><p className="mt-2 text-sm text-muted">{impacts.filter((i) => i.matterId === matter.id).length} open update matches</p></Card>
        <Card><h3 className="font-semibold">Open tasks</h3><p className="mt-2 text-sm text-muted">{tasks.filter((t) => t.matterId === matter.id && t.status !== "Done").length} active tasks</p></Card>
      </section>

      {matter.visaSubclass === "500" ? (
        <Card className="mt-4">
          <h3 className="font-semibold">Subclass 500 draft workflow</h3>
          <p className="mt-2 text-sm text-muted">Open the source-linked draft application workspace for document mapping, validation, evidence packaging, and client review preparation.</p>
          <Link href={`/app/matters/${matter.id}/draft`} className="mt-3 inline-flex rounded-lg bg-accent px-4 py-2 text-sm text-white">Open draft workflow</Link>
        </Card>
      ) : null}
    </AppShell>
  );
}
