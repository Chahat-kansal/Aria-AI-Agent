import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { UpdatesIngestAction } from "@/components/app/updates-ingest-action";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getUpdatesData } from "@/lib/data/workspace-repository";
import { hasPermission } from "@/lib/services/roles";

export default async function UpdatesPage() {
  const context = await getCurrentWorkspaceContext();
  if (context && !hasPermission(context.user, "can_access_update_monitor")) {
    return (
      <AppShell title="Updates Monitor">
        <PageHeader title="Updates monitor unavailable" subtitle="Your company administrator controls official update monitoring access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to view official update monitoring or affected-matter alerts.</p></Card>
      </AppShell>
    );
  }
  const updates = context ? await getUpdatesData(context.workspace.id, context.user) : [];
  const impacts = updates.flatMap((update) => update.impacts.map((impact) => ({ ...impact, update })));

  return (
    <AppShell title="Updates Monitor">
      <PageHeader
        title="Official Updates Monitor"
        subtitle="Track source-linked policy and procedure updates, then map potential matter impact. Review required."
        actions={<UpdatesIngestAction />}
      />
      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-3 flex gap-2 text-xs"><span className="rounded bg-white/60 px-2 py-1">Source-linked records</span><span className="rounded bg-white/60 px-2 py-1">Review required</span><span className="rounded bg-white/60 px-2 py-1">Hash deduped</span></div>
          <div className="space-y-3">
            {updates.length ? updates.map((update) => (
              <Link href={`/app/updates/${update.id}`} key={update.id} className="block rounded-lg border border-border p-3 hover:bg-white/65">
                <p className="font-medium">{update.title}</p>
                <p className="text-sm text-muted">{update.source} · Published {formatDate(update.publishedAt)} · {update.updateType}</p>
                <p className="text-sm text-muted">{update.summary}</p>
                <p className="mt-2 text-xs text-muted">{update.impacts.length} potential matter impacts flagged</p>
              </Link>
            )) : (
              <p className="rounded-lg border border-border p-4 text-sm text-muted">No official update records are stored yet. Run source check after enabling ingestion to fetch official-source records.</p>
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
                <p className="mt-1 text-xs text-muted">{impact.actionRequired ?? "Agent review required before action."}</p>
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
