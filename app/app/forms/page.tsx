import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getOverview } from "@/lib/data/demo-repository";

export default function FormsPage() {
  const { extractedFields, documents } = getOverview();

  return (
    <AppShell title="Forms & Field Review">
      <PageHeader title="Form Draft & Field Review" subtitle="Source-linked extracted fields. Manual verification is required before submission readiness." />
      <Card>
        <div className="space-y-3">
          {extractedFields.map((f) => {
            const doc = documents.find((d) => d.id === f.documentId);
            return (
              <div key={f.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">Section · {f.fieldKey.split("_")[0]}</p>
                    <p className="font-medium">{f.fieldLabel}</p>
                    <p className="text-sm">{f.fieldValue || "— Missing —"}</p>
                    <p className="text-xs text-muted">Source: {doc?.fileName} · {f.sourcePageRef}</p>
                    <p className="mt-1 text-xs text-muted">Snippet: “{f.sourceSnippet}”</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="mb-2">Confidence: {Math.round(f.confidence * 100)}%</p>
                    <StatusChip label={f.status} />
                    <div className="mt-3 flex gap-1">
                      <button className="rounded border border-border px-2 py-1">Verify</button>
                      <button className="rounded border border-border px-2 py-1">Needs review</button>
                      <button className="rounded border border-border px-2 py-1">Override</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
