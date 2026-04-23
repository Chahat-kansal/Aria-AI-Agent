import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getUpdateDetailData } from "@/lib/data/workspace-repository";
import { hasPermission } from "@/lib/services/roles";

export default async function UpdateDetailPage({ params }: { params: { updateId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return <AppShell title="Updates Monitor"><PageHeader title="Workspace setup required" subtitle="Create or join a workspace to review official update records." /></AppShell>;
  if (!hasPermission(context.user, "can_access_update_monitor")) {
    return (
      <AppShell title="Updates Monitor">
        <PageHeader title="Updates monitor unavailable" subtitle="Your company administrator controls official update monitoring access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to view official update records.</p></Card>
      </AppShell>
    );
  }

  const update = await getUpdateDetailData(context.workspace.id, params.updateId, context.user);
  if (!update) notFound();

  return (
    <AppShell title="Updates Monitor">
      <PageHeader title={update.title} subtitle={`${update.source} · Effective ${formatDate(update.effectiveDate)}`} />
      <Card>
        <p className="text-sm text-muted">{update.summary}</p>
        <p className="mt-2 text-xs text-muted">Published {formatDate(update.publishedAt)} · Type {update.updateType} · Ingested {formatDate(update.ingestedAt)}</p>
        <p className="mt-1 text-xs text-muted">Source monitor: {update.officialSource?.name ?? update.source}</p>
        <a href={update.sourceUrl} className="mt-2 block text-sm text-accent" target="_blank">Open source publication</a>
      </Card>
      <Card className="mt-4">
        <h3 className="font-semibold">Potentially affected matters</h3>
        <div className="mt-3 space-y-2">
          {update.impacts.length ? update.impacts.map((impact) => (
            <div key={impact.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Link href={`/app/matters/${impact.matterId}`} className="font-medium text-accent">{impact.matter.client.firstName} {impact.matter.client.lastName}</Link>
                <StatusChip label={formatEnum(impact.impactLevel)} />
              </div>
              <p className="text-sm text-muted">Why matched: {impact.reason}</p>
              <p className="text-xs text-muted">Action required: {impact.actionRequired ?? "Review source-linked update against the matter."}</p>
              <p className="text-xs text-muted">Review state: {formatEnum(impact.status)}</p>
            </div>
          )) : (
            <p className="rounded-lg border border-border p-4 text-sm text-muted">This update has no affected matters recorded for the current workspace.</p>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
