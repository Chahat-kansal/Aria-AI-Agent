import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { getVisaKnowledgeRecord } from "@/lib/services/visa-knowledge";

function asList(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export default async function VisaKnowledgeDetailPage({ params }: { params: { recordId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (context && !hasPermission(context.user, "can_access_visa_knowledge")) {
    return (
      <AppShell title="Visa Knowledge">
        <PageHeader title="Visa knowledge unavailable" subtitle="Your company administrator controls visa knowledge access for each staff user." />
        <Card><p className="text-sm text-muted">You do not currently have permission to view visa knowledge records.</p></Card>
      </AppShell>
    );
  }
  const record = await getVisaKnowledgeRecord(params.recordId);
  if (!record) notFound();

  return (
    <AppShell title="Visa Knowledge">
      <PageHeader
        title={record.title}
        subtitle="Source-linked visa knowledge for AI-assisted research. Review official source material before client advice."
      />
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">{record.subclassCode ? `Subclass ${record.subclassCode}` : "Visa / citizenship knowledge"}</p>
          <h3 className="mt-2 text-xl font-semibold">Summary</h3>
          <p className="mt-3 text-sm leading-7 text-muted">{record.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            {record.stream ? <span className="rounded-full border border-border bg-white/50 px-3 py-1">Stream: {record.stream}</span> : null}
            <span className="rounded-full border border-border bg-white/50 px-3 py-1">Source type: {record.sourceType}</span>
            <span className="rounded-full border border-border bg-white/50 px-3 py-1">Updated: {record.lastRefreshedAt.toLocaleString("en-AU")}</span>
          </div>
          <a href={record.sourceUrl} className="mt-5 inline-flex rounded-lg bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white">
            Open live official source
          </a>
        </Card>
        <Card>
          <h3 className="font-semibold">Use in workflow</h3>
          <p className="mt-2 text-sm text-muted">
            This record can guide subclass selection and Aria research. A field-level draft template is only available where configured, and all output remains review required.
          </p>
        </Card>
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Key requirements</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">{asList(record.keyRequirementsJson).map((item) => <li key={item}>- {item}</li>)}</ul>
        </Card>
        <Card>
          <h3 className="font-semibold">Evidence expectations</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">{asList(record.evidenceJson).map((item) => <li key={item}>- {item}</li>)}</ul>
        </Card>
      </section>
    </AppShell>
  );
}
