import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getOverview } from "@/lib/data/demo-repository";

export default function ValidationPage() {
  const { issues } = getOverview();

  return (
    <AppShell title="Validation">
      <PageHeader title="Validation Engine" subtitle="Automated checks identify data inconsistencies and missing evidence. Practitioner review required." />
      <Card>
        <div className="space-y-2">
          {issues.map((issue) => (
            <div key={issue.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{issue.title}</p>
                <StatusChip label={issue.severity} />
              </div>
              <p className="mt-1 text-sm text-muted">Type: {issue.type} · Related field: {issue.relatedFieldKey ?? "n/a"}</p>
              <p className="mt-1 text-sm text-muted">Recommendation: review source-linked fields/documents and resolve before final submission readiness check.</p>
              <div className="mt-2 flex gap-2 text-xs text-muted"><span className="rounded bg-[#111a2b] px-2 py-1">Resolution: {issue.resolutionStatus}</span><span className="rounded bg-[#111a2b] px-2 py-1">Link to affected matter</span></div>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
