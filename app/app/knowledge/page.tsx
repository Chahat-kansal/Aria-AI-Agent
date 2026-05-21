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

function resultTags(record: { subclassCode: string | null; stream: string | null; keyRequirementsJson: unknown; evidenceJson: unknown }) {
  return [
    record.subclassCode ? `Subclass ${record.subclassCode}` : null,
    record.stream,
    ...asList(record.keyRequirementsJson),
    ...asList(record.evidenceJson)
  ].filter(Boolean).slice(0, 6) as string[];
}

export default async function KnowledgePage({ searchParams }: { searchParams?: { q?: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (context && !hasPermission(context.user, "can_access_visa_knowledge")) {
    return (
      <AppShell title="Visa Knowledge">
        <PageHeader title="Visa knowledge unavailable" subtitle="Your company administrator controls visa knowledge access for each staff user." />
        <Card><p className="text-sm text-muted">You do not currently have permission to search visa knowledge records. Ask a Company Owner or Access Administrator to enable the Access visa knowledge permission for your account.</p></Card>
      </AppShell>
    );
  }
  const query = searchParams?.q ?? "";
  const records = await getVisaKnowledgeRecords(query, { liveRefresh: Boolean(query.trim()) });

  return (
    <AppShell title="Visa Knowledge">
      <PageHeader
        title="Official Visa Knowledge"
        subtitle="Search source-linked Australian visa and citizenship knowledge by subclass, evidence type, or pathway."
      />
      <Card className="mb-5">
        <div className="space-y-4">
          <VisaKnowledgeSearch defaultValue={query} />
          <div className="flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted">
              {query ? `${records.length} result${records.length === 1 ? "" : "s"} for "${query}"` : `${records.length} stored visa and citizenship knowledge record${records.length === 1 ? "" : "s"}`}
            </p>
            <VisaKnowledgeIngestAction />
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {records.length ? (
          <div className="grid gap-4">
            {records.map((record) => (
              <article key={record.id} className="panel p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                        {record.subclassCode ? `Subclass ${record.subclassCode}` : "Visa / citizenship knowledge"}
                      </span>
                      <span className="rounded-full bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)]">
                        {record.sourceType || "Official source"}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        Source-linked
                      </span>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                        Agent review required
                      </span>
                    </div>
                    <Link href={`/app/knowledge/${record.id}`} className="block text-xl font-semibold text-[color:var(--text-primary)] transition hover:text-[color:var(--accent)]">
                      {record.title}
                    </Link>
                    <p className="mt-3 max-w-4xl text-sm leading-6 text-[color:var(--text-secondary)]">{record.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {resultTags(record).map((tag) => (
                        <span key={tag} className="rounded-full bg-[color:var(--surface-soft)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="w-full shrink-0 rounded-2xl bg-[color:var(--surface-soft)] p-4 text-sm lg:w-72">
                    <p className="font-semibold text-[color:var(--text-primary)]">Record status</p>
                    <p className="mt-2 text-[color:var(--text-secondary)]">Source-linked guidance for agent review. Not final legal advice.</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">Last updated</p>
                    <p className="mt-1 text-[color:var(--text-primary)]">{record.lastRefreshedAt.toLocaleString("en-AU")}</p>
                    {record.sourceUrl ? <a href={record.sourceUrl} className="mt-3 inline-flex text-sm font-semibold text-[color:var(--accent)]">Open official source</a> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px] lg:p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-tertiary)]">Knowledge library</p>
                <h3 className="mt-3 text-2xl font-semibold text-[color:var(--text-primary)]">No visa knowledge records found</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
                  Refresh official knowledge or search another term. Aria shows source-linked guidance for agent review and does not present records as legal advice.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <VisaKnowledgeIngestAction />
                  <Link href="/app/settings/security/launch-readiness" className="inline-flex h-10 items-center justify-center rounded-xl bg-[color:var(--surface-soft)] px-4 text-sm font-semibold text-[color:var(--text-primary)] shadow-sm transition hover:text-[color:var(--accent)]">
                    View supported subclasses
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
                <p className="font-semibold text-[color:var(--text-primary)]">Try searching for</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Subclass 500", "Subclass 482", "English evidence", "Health insurance", "Partner evidence", "Visitor funds"].map((term) => (
                    <Link key={term} href={`/app/knowledge?q=${encodeURIComponent(term)}`} className="rounded-full bg-[color:var(--surface-strong)] px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)] transition hover:text-[color:var(--accent)]">
                      {term}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
