import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatEnum, getValidationData } from "@/lib/data/workspace-repository";

export default async function ValidationPage() {
  const context = await getCurrentWorkspaceContext();
  const issues = context ? await getValidationData(context.workspace.id, context.user) : [];

  return (
    <AppShell title="Validation">
      <PageHeader title="Validation Engine" subtitle="Automated checks identify data inconsistencies and missing evidence. Practitioner review required." />
      <Card>
        <div className="space-y-2">
          {issues.length ? issues.map((issue) => (
            <div key={issue.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{issue.title}</p>
                <StatusChip label={formatEnum(issue.severity)} />
              </div>
              <p className="mt-1 text-sm text-muted">{issue.matter.client.firstName} {issue.matter.client.lastName} · {issue.type} · Related field: {issue.relatedFieldKey ?? "n/a"}</p>
              <p className="mt-1 text-sm text-muted">{issue.description}</p>
              <div className="mt-2 flex gap-2 text-xs text-muted">
                <span className="rounded bg-white/60 px-2 py-1">Resolution: {formatEnum(issue.resolutionStatus)}</span>
                <Link href={`/app/matters/${issue.matterId}` as any} className="rounded bg-white/60 px-2 py-1 text-accent">Open affected matter</Link>
              </div>
            </div>
          )) : (
            <p className="rounded-lg border border-border p-4 text-sm text-muted">No validation issues are recorded for this workspace.</p>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
