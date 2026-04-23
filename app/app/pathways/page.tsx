import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { PathwayAnalysisForm } from "@/components/app/pathway-analysis-form";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getPathwayAnalyses } from "@/lib/services/pathway-analysis";
import { prisma } from "@/lib/prisma";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";

export default async function PathwaysPage() {
  const context = await getCurrentWorkspaceContext();
  if (context && !hasPermission(context.user, "can_run_pathway_analysis")) {
    return (
      <AppShell title="Pathway Analysis">
        <PageHeader title="Pathway analysis unavailable" subtitle="Your company administrator controls AI-assisted pathway analysis access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to create or view AI-assisted pathway analyses.</p></Card>
      </AppShell>
    );
  }
  const analyses = context ? await getPathwayAnalyses(context.workspace.id, context.user) : [];
  const matters = context
    ? await prisma.matter.findMany({
        where: scopedMatterWhere(context.user),
        include: { client: true },
        orderBy: { createdAt: "desc" }
      })
    : [];

  return (
    <AppShell title="Pathway Analysis">
      <PageHeader
        title="PR & Citizenship Pathway Analysis"
        subtitle="Create AI-assisted scenario analysis for potential Australian PR pathways and longer-term citizenship considerations. Review required before client advice."
      />
      <Card className="mb-4">
        <h3 className="font-semibold">Create pathway analysis</h3>
        <p className="mb-3 mt-1 text-sm text-muted">
          Capture structured facts and free-text context. Aria will rank potential pathway groups, evidence gaps, blockers, and next review actions as review-required scenario analysis.
        </p>
        <PathwayAnalysisForm matters={matters} />
      </Card>

      <div className="panel overflow-hidden">
        {analyses.length ? (
          <table className="w-full text-sm">
            <thead className="bg-white/70 text-muted">
              <tr>
                <th className="p-3 text-left">Analysis</th>
                <th className="p-3 text-left">Client / matter</th>
                <th className="p-3 text-left">Strongest pathway</th>
                <th className="p-3 text-center">Options</th>
                <th className="p-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((analysis) => (
                <tr key={analysis.id} className="border-t border-border hover:bg-white/65">
                  <td className="p-3">
                    <Link href={`/app/pathways/${analysis.id}`} className="font-medium text-accent">{analysis.title}</Link>
                    <p className="mt-1 max-w-xl text-xs text-muted">{analysis.summary}</p>
                  </td>
                  <td className="p-3 text-muted">
                    {analysis.client ? `${analysis.client.firstName} ${analysis.client.lastName}` : "Unlinked intake"}
                    {analysis.matter ? <p className="text-xs">{analysis.matter.title}</p> : null}
                  </td>
                  <td className="p-3">{analysis.options[0]?.title ?? "Evidence intake required"}</td>
                  <td className="p-3 text-center">{analysis._count.options}</td>
                  <td className="p-3 text-muted">{analysis.createdAt.toLocaleDateString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-muted">No pathway analyses are stored yet. Create one from real intake facts to compare potential PR pathways and citizenship considerations.</p>
        )}
      </div>
    </AppShell>
  );
}
