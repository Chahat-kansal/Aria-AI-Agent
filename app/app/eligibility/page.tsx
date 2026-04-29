import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { PathwayAnalysisForm } from "@/components/app/pathway-analysis-form";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { getPathwayAnalyses } from "@/lib/services/pathway-analysis";

export default async function EligibilityPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_run_pathway_analysis")) {
    return (
      <AppShell title="Eligibility">
        <PageHeader title="Eligibility pre-screen unavailable" subtitle="Your company administrator controls AI-assisted eligibility analysis access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to run AI-assisted eligibility pre-screens.</p></Card>
      </AppShell>
    );
  }

  const [analyses, matters] = await Promise.all([
    getPathwayAnalyses(context.workspace.id, context.user),
    prisma.matter.findMany({
      where: scopedMatterWhere(context.user),
      include: { client: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <AppShell title="Eligibility">
      <PageHeader title="Visa Eligibility Pre-Screen" subtitle="Capture client facts and ask Aria to produce likely pathways, blockers, missing evidence, and next review actions. Review required before any recommendation." />
      <Card className="mb-4">
        <h3 className="font-semibold">Create eligibility pre-screen</h3>
        <p className="mb-3 mt-1 text-sm text-muted">This uses the live pathway analysis engine and stores a real database-backed analysis linked to the client matter where available.</p>
        <PathwayAnalysisForm matters={matters} />
      </Card>

      <div className="panel overflow-hidden">
        {analyses.length ? (
          <div className="divide-y divide-border">
            {analyses.map((analysis) => (
              <a key={analysis.id} href={`/app/eligibility/${analysis.id}`} className="block p-4 hover:bg-white/60">
                <p className="font-medium text-accent">{analysis.title}</p>
                <p className="mt-1 text-sm text-muted">{analysis.summary}</p>
              </a>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-muted">No eligibility analyses are stored yet. Create one above from real intake facts.</p>
        )}
      </div>
    </AppShell>
  );
}
