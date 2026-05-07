import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ExtractionReviewDashboard } from "@/components/app/extraction-review-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getMatterExtractionReviewData } from "@/lib/services/extraction-review";

export default async function MatterExtractionReviewPage({ params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return (
      <AppShell title="Extraction review">
        <div className="space-y-6">
          <PageHeader title="Workspace setup required" description="Create or join a workspace to review extracted evidence." />
        </div>
      </AppShell>
    );
  }

  const data = await getMatterExtractionReviewData(context.workspace.id, params.matterId, context.user);
  if (!data) notFound();

  return (
    <AppShell title="Extraction review">
      <div className="space-y-8">
        <PageHeader
          eyebrow="EVIDENCE REVIEW"
          title={`${data.summary.applicantName} · extraction dashboard`}
          description={`${data.summary.visaSubclass} ${data.summary.visaStream} · source-linked review workspace`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={data.summary.activeFlags ? "warning" : "success"}>{data.summary.reviewStatus}</StatusPill>
              <StatusPill>{data.summary.uploadedDocuments} documents</StatusPill>
            </div>
          }
        />

        {!data.summary.hasExtractedEvidence ? (
          <EmptyState
            title="Upload documents or run extraction to build this review dashboard."
            description="Aria will only show extraction-backed sections here when secure document uploads have produced stored extraction records."
            action={<Link href={data.summary.documentsHref as any} className="inline-flex h-11 items-center justify-center rounded-[1.35rem] bg-gradient-to-r from-violet-500 via-violet-400 to-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_14px_48px_rgba(34,211,238,0.22)] transition hover:scale-[1.01] hover:opacity-95">Upload documents</Link>}
          />
        ) : null}

        <ExtractionReviewDashboard data={data} />
      </div>
    </AppShell>
  );
}
