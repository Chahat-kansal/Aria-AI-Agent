import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getUpdatesData } from "@/lib/data/workspace-repository";

export default async function UpdatesPage() {
  const context = await getCurrentWorkspaceContext();
  const updates = context ? await getUpdatesData(context.workspace.id) : [];
  const impacts = updates.flatMap((update) => update.impacts.map((impact) => ({ ...impact, update })));

  return (
    <AppShell title="Updates Monitor">
      <PageHeader title="Official Updates Monitor" subtitle="Track stored source-linked policy and procedure updates, then map likely matter impact." />
      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-3 flex gap-2 text-xs"><span className="rounded bg-[#111a2b] px-2 py-1">Source-linked records</span><span className="rounded bg-[#111a2b] px-2 py-1">Review required</span><span className="rounded bg-[#111a2b] px-2 py-1">No live ingestion yet</span></div>
          <div className="space-y-3">
            {updates.length ? updates.map((update) => (
              <Link href={`/app/updates/${update.id}`} key={update.id} className="block rounded-lg border border-border p-3 hover:bg-[#0f1727]">
                <p className="font-medium">{update.title}</p>
                <p className="text-sm text-muted">{update.source} · Published {formatDate(update.publishedAt)}</p>
                <p className="text-sm text-muted">{update.summary}</p>
              </Link>
            )) : (
              <p className="rounded-lg border border-border p-4 text-sm text-muted">No official update records are stored yet. Scheduled ingestion is not enabled in this phase.</p>
            )}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold">Impact Summary</h3>
          <div className="mt-3 space-y-2">
            {impacts.length ? impacts.slice(0, 8).map((impact) => (
              <div key={impact.id} className="rounded-lg border border-border p-2">
                <div className="flex items-center justify-between"><p className="text-sm">{impact.matter.client.firstName} {impact.matter.client.lastName}</p><StatusChip label={formatEnum(impact.impactLevel)} /></div>
                <p className="mt-1 text-xs text-muted">{impact.reason}</p>
              </div>
            )) : (
              <p className="text-sm text-muted">No matter impacts are recorded.</p>
            )}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
