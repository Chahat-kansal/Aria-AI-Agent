import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getPathwayAnalysisDetail } from "@/lib/services/pathway-analysis";

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function JsonList({ title, value }: { title: string; value: unknown }) {
  const items = asList(value);
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {items.map((item) => <li key={item}>- {item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No items recorded.</p>
      )}
    </div>
  );
}

export default async function PathwayDetailPage({ params }: { params: { analysisId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return <AppShell title="Pathway Analysis"><PageHeader title="Workspace setup required" subtitle="Create or join a workspace to review pathway analyses." /></AppShell>;
  }

  const analysis = await getPathwayAnalysisDetail(context.workspace.id, params.analysisId);
  if (!analysis) notFound();

  const profile = analysis.profileJson as Record<string, unknown>;

  return (
    <AppShell title="Pathway Analysis">
      <PageHeader title={analysis.title} subtitle="AI-assisted scenario analysis. Registered migration agent review is required before client advice or application strategy." />

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Review summary</p>
          <h3 className="mt-2 text-lg font-semibold">{analysis.summary}</h3>
          <p className="mt-3 text-sm text-muted">
            Created by {analysis.createdByUser.name} on {analysis.createdAt.toLocaleString("en-AU")}. This analysis identifies potential pathways and evidence gaps, not a final legal conclusion.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            {analysis.client ? <span className="rounded-full border border-border px-3 py-1">Client: {analysis.client.firstName} {analysis.client.lastName}</span> : null}
            {analysis.matter ? <Link href={`/app/matters/${analysis.matter.id}`} className="rounded-full border border-border px-3 py-1 text-accent">Matter: {analysis.matter.title}</Link> : null}
            <span className="rounded-full border border-border px-3 py-1">Review required</span>
          </div>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Normalized profile</p>
          <div className="mt-3 grid gap-2 text-sm">
            {["currentVisaStatus", "age", "occupation", "englishLevel", "location", "employerSponsorship"].map((key) => (
              <div key={key} className="flex justify-between gap-3 border-b border-border pb-2">
                <span className="text-muted">{key.replace(/([A-Z])/g, " $1")}</span>
                <span className="text-right">{String(profile[key] ?? "Not provided")}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card><JsonList title="Assumptions" value={analysis.assumptionsJson} /></Card>
        <Card><JsonList title="Blockers / risks to clarify" value={analysis.blockersJson} /></Card>
        <Card><JsonList title="Evidence gaps" value={analysis.evidenceGapsJson} /></Card>
      </div>

      <div className="space-y-4">
        {analysis.options.map((option) => (
          <Card key={option.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Rank {option.rank} - {option.pathwayType}</p>
                <h3 className="mt-1 text-lg font-semibold">{option.title}</h3>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">{Math.round(option.confidence * 100)}% confidence</span>
            </div>
            <p className="mt-3 text-sm text-muted">{option.relevance}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <JsonList title="Conditions to review" value={option.conditionsJson} />
              <JsonList title="Missing evidence" value={option.missingJson} />
              <JsonList title="Risks" value={option.risksJson} />
              <JsonList title="Next actions" value={option.nextActionsJson} />
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
