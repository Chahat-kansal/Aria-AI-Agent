import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getOverview } from "@/lib/data/demo-repository";

export default function UpdatesPage() {
  const { updates, impacts } = getOverview();

  return (
    <AppShell title="Updates Monitor">
      <PageHeader title="Official Updates Monitor" subtitle="Track source-linked policy and procedure updates, then map likely matter impact." />
      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-3 flex gap-2 text-xs"><span className="rounded bg-[#111a2b] px-2 py-1">Source: all official</span><span className="rounded bg-[#111a2b] px-2 py-1">Type: all</span><span className="rounded bg-[#111a2b] px-2 py-1">Window: 90 days</span></div>
          <div className="space-y-3">{updates.map((u) => <Link href={`/app/updates/${u.id}`} key={u.id} className="block rounded-lg border border-border p-3 hover:bg-[#0f1727]"><p className="font-medium">{u.title}</p><p className="text-sm text-muted">{u.source} · Published {u.publishedAt}</p><p className="text-sm text-muted">{u.summary}</p></Link>)}</div>
        </Card>
        <Card>
          <h3 className="font-semibold">Impact Summary</h3>
          <div className="mt-3 space-y-2">{impacts.slice(0, 8).map((impact) => <div key={impact.id} className="rounded-lg border border-border p-2"><div className="flex items-center justify-between"><p className="text-sm">{impact.matterId}</p><StatusChip label={impact.impactLevel} /></div><p className="mt-1 text-xs text-muted">{impact.reason}</p></div>)}</div>
        </Card>
      </section>
    </AppShell>
  );
}
