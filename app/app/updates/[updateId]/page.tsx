import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getOverview } from "@/lib/data/demo-repository";

export default function UpdateDetailPage({ params }: { params: { updateId: string } }) {
  const { updates, impacts } = getOverview();
  const update = updates.find((u) => u.id === params.updateId) ?? updates[0];
  const related = impacts.filter((i) => i.officialUpdateId === update.id);

  return (
    <AppShell title="Updates Monitor">
      <PageHeader title={update.title} subtitle={`${update.source} · Effective ${update.effectiveDate ?? "TBC"}`} />
      <Card>
        <p className="text-sm text-muted">{update.summary}</p>
        <a href={update.sourceUrl} className="mt-2 block text-sm text-accent" target="_blank">Open source publication</a>
      </Card>
      <Card className="mt-4">
        <h3 className="font-semibold">Potentially affected matters</h3>
        <div className="mt-3 space-y-2">{related.map((impact) => <div key={impact.id} className="rounded-lg border border-border p-3"><div className="flex items-center justify-between"><p className="font-medium">{impact.matterId}</p><StatusChip label={impact.impactLevel} /></div><p className="text-sm text-muted">Why matched: {impact.reason}</p><p className="text-xs text-muted">Action state: {impact.status}</p></div>)}</div>
      </Card>
    </AppShell>
  );
}
