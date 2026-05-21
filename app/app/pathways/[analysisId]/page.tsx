import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { Card } from "@/components/ui/card";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { buildPathwayGroundedResponse, getPathwayAnalysisDetail } from "@/lib/services/pathway-analysis";
import { calculateIndicativeSkilledPoints } from "@/lib/services/skilled-points";
import { hasPermission } from "@/lib/services/roles";

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
  if (!hasPermission(context.user, "can_run_pathway_analysis")) {
    return (
      <AppShell title="Pathway Analysis">
        <PageHeader title="Pathway analysis unavailable" subtitle="Your company administrator controls AI-assisted pathway analysis access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to view AI-assisted pathway analyses.</p></Card>
      </AppShell>
    );
  }

  const analysis = await getPathwayAnalysisDetail(context.workspace.id, params.analysisId, context.user);
  if (!analysis) notFound();

  const profile = analysis.profileJson as Record<string, unknown>;
  const points = calculateIndicativeSkilledPoints(profile);
  const grounded = buildPathwayGroundedResponse(analysis);

  return (
    <AppShell title="Pathway Analysis">
      <PageHeader title={analysis.title} subtitle="Preliminary AI-assisted pathway analysis. Possible pathways for agent review only. Registered migration agent review is required before client advice or application strategy." />
      <div className="mb-4">
        <AIReviewNotice />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Review summary</p>
          <h3 className="mt-2 text-lg font-semibold">{analysis.summary}</h3>
          <p className="mt-3 text-sm text-muted">
            Created by {analysis.createdByUser.name} on {analysis.createdAt.toLocaleString("en-AU")}. This analysis identifies possible pathways and evidence gaps, not a final legal conclusion or outcome guarantee.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            {analysis.client ? <span className="rounded-full border border-border px-3 py-1">Client: {analysis.client.firstName} {analysis.client.lastName}</span> : null}
            {analysis.matter ? <Link href={`/app/matters/${analysis.matter.id}` as any} className="rounded-full border border-border px-3 py-1 text-accent">Matter: {analysis.matter.title}</Link> : null}
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

      <Card className="mb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Grounded pathway summary</p>
        <h3 className="mt-2 text-lg font-semibold">{grounded.answer}</h3>
        <JsonList title="Evidence used" value={grounded.evidence.map((item) => `${item.title}: ${item.snippet ?? "No snippet recorded."}`)} />
        <JsonList title="Missing information" value={grounded.missingInformation} />
        <JsonList title="Warnings" value={grounded.warnings} />
      </Card>

      <Card className="mb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Indicative skilled points snapshot</p>
        <h3 className="mt-2 text-lg font-semibold">{points.total} points recorded from currently supplied profile evidence</h3>
        <p className="mt-2 text-sm text-muted">This does not guarantee invitation or final eligibility. Any missing evidence below should be treated as unverified.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {points.breakdown.map((item) => (
            <div key={item.key} className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">{item.label}</p>
              <p className="mt-2 text-lg font-semibold">{item.points}</p>
              <JsonList title="Evidence" value={item.evidence} />
              <JsonList title="Missing evidence" value={item.missingEvidence} />
            </div>
          ))}
        </div>
      </Card>

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
