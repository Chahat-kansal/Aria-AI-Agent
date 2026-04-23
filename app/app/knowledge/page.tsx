import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { VisaKnowledgeIngestAction } from "@/components/app/visa-knowledge-ingest-action";
import { VisaKnowledgeSearch } from "@/components/app/visa-knowledge-search";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { getVisaKnowledgeRecords } from "@/lib/services/visa-knowledge";

function asList(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export default async function KnowledgePage({ searchParams }: { searchParams?: { q?: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (context && !hasPermission(context.user, "can_access_visa_knowledge")) {
    return (
      <AppShell title="Visa Knowledge">
        <PageHeader title="Visa knowledge unavailable" subtitle="Your company administrator controls visa knowledge access for each staff user." />
        <Card><p className="text-sm text-muted">You do not currently have permission to search visa knowledge records. Ask a Company Owner or Access Administrator to enable “Access visa knowledge” for your account.</p></Card>
      </AppShell>
    );
  }
  const query = searchParams?.q ?? "";
  const records = await getVisaKnowledgeRecords(query);

  return (
    <AppShell title="Visa Knowledge">
      <PageHeader
        title="Official Visa Knowledge"
        subtitle="Search source-linked visa and citizenship knowledge by subclass, visa name, evidence, or pathway terms."
      />
      <Card className="mb-4">
        <div className="space-y-4">
          <VisaKnowledgeSearch defaultValue={query} />
          <div className="flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted">
              {query ? `${records.length} result${records.length === 1 ? "" : "s"} for "${query}"` : `${records.length} stored knowledge record${records.length === 1 ? "" : "s"}`}
            </p>
            <VisaKnowledgeIngestAction />
          </div>
        </div>
      </Card>

      <div className="panel overflow-hidden">
        {records.length ? (
          <div className="divide-y divide-border">
            {records.map((record) => (
              <div key={record.id} className="grid gap-4 p-4 lg:grid-cols-[1.3fr_1fr_1fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{record.subclassCode ? `Subclass ${record.subclassCode}` : "Visa / citizenship knowledge"}</p>
                  <Link href={`/app/knowledge/${record.id}`} className="mt-1 block font-semibold text-[#182033] hover:text-accent">{record.title}</Link>
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
            <h3 className="font-semibold">{query ? "No matching visa knowledge records" : "No visa knowledge records stored yet"}</h3>
            <p className="mt-2 text-sm text-muted">
              {query
                ? "Try searching by subclass number, visa name, stream, evidence type, or pathway term. If records are empty, refresh official visa knowledge first."
                : "Run a refresh to ingest official public visa knowledge. Until then, Aria will not pretend broader visa knowledge is configured."}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
