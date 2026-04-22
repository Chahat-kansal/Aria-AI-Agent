import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { VisaKnowledgeIngestAction } from "@/components/app/visa-knowledge-ingest-action";
import { getVisaKnowledgeRecords } from "@/lib/services/visa-knowledge";

function asList(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export default async function KnowledgePage() {
  const records = await getVisaKnowledgeRecords();

  return (
    <AppShell title="Visa Knowledge">
      <PageHeader
        title="Official Visa Knowledge"
        subtitle="Stored source-linked visa and citizenship knowledge used by Aria for broader subclass selection and review-required research."
      />
      <Card className="mb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold">Knowledge ingestion</h3>
            <p className="mt-1 text-sm text-muted">
              Refresh official public visa pages. If a search provider is configured, Aria also enriches records from source-linked official web retrieval.
            </p>
          </div>
          <VisaKnowledgeIngestAction />
        </div>
      </Card>

      <div className="panel overflow-hidden">
        {records.length ? (
          <div className="divide-y divide-border">
            {records.map((record) => (
              <div key={record.id} className="grid gap-4 p-4 lg:grid-cols-[1.3fr_1fr_1fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{record.subclassCode ? `Subclass ${record.subclassCode}` : "Visa / citizenship knowledge"}</p>
                  <h3 className="mt-1 font-semibold">{record.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{record.summary}</p>
                  <a href={record.sourceUrl} className="mt-2 inline-flex text-xs text-accent">Official source</a>
                </div>
                <div>
                  <p className="text-sm font-medium">Key requirements</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted">{asList(record.keyRequirementsJson).slice(0, 4).map((item) => <li key={item}>- {item}</li>)}</ul>
                </div>
                <div>
                  <p className="text-sm font-medium">Evidence expectations</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted">{asList(record.evidenceJson).slice(0, 4).map((item) => <li key={item}>- {item}</li>)}</ul>
                  <p className="mt-3 text-xs text-muted">Refreshed {record.lastRefreshedAt.toLocaleString("en-AU")}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6">
            <h3 className="font-semibold">No visa knowledge records stored yet</h3>
            <p className="mt-2 text-sm text-muted">
              Run a refresh to ingest official public visa knowledge. Until then, Aria will not pretend broader visa knowledge is configured.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
