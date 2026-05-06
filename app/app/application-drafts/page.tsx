import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { formatEnum } from "@/lib/data/workspace-repository";

export default async function ApplicationDraftsPage() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Application Drafts">
        <PageHeader title="Application drafts" description="Create or join a workspace to review matter-linked application drafts." />
      </AppShell>
    );
  }

  const drafts = await prisma.matterApplicationDraft.findMany({
    where: {
      matter: scopedMatterWhere(context.user)
    },
    include: {
      matter: { include: { client: true } },
      fields: true,
      reviewRequests: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <AppShell title="Application Drafts">
      <div className="space-y-8">
        <PageHeader
          eyebrow="APPLICATION DRAFTS"
          title="Matter-linked draft reviews"
          description="Only real matter drafts are shown here. Aria does not create fake standalone application draft records."
        />

        <PageSection title="Drafts needing review" description="Open the matter draft workspace to review source-backed suggestions, field confidence, and client review state.">
          {drafts.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {drafts.map((draft) => {
                const verifiedCount = draft.fields.filter((field) => field.status === "VERIFIED").length;
                const needsReviewCount = draft.fields.filter((field) => field.status === "NEEDS_REVIEW" || field.status === "CONFLICTING").length;
                return (
                  <Link key={draft.id} href={`/app/matters/${draft.matterId}/draft`}>
                    <SectionCard className="space-y-4 p-5 transition hover:bg-white/[0.05]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">{draft.matter.client.firstName} {draft.matter.client.lastName}</p>
                          <p className="mt-1 text-sm text-slate-400">{draft.matter.title} · Subclass {draft.matter.visaSubclass}</p>
                        </div>
                        <StatusPill tone={draft.readinessScore >= 85 ? "success" : draft.readinessScore >= 65 ? "warning" : "danger"}>
                          {draft.readinessScore}% ready
                        </StatusPill>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3 text-sm">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-slate-300">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
                          <p className="mt-2 text-white">{formatEnum(draft.status)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-slate-300">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Verified</p>
                          <p className="mt-2 text-white">{verifiedCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-slate-300">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Needs review</p>
                          <p className="mt-2 text-white">{needsReviewCount}</p>
                        </div>
                      </div>
                      {draft.reviewRequests[0] ? (
                        <p className="text-xs text-slate-500">Latest client review: {formatEnum(draft.reviewRequests[0].status)}</p>
                      ) : (
                        <p className="text-xs text-slate-500">No client review request has been sent yet.</p>
                      )}
                    </SectionCard>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No matter drafts are in scope yet"
              description={hasPermission(context.user, "can_edit_matters") ? "Create a matter, upload secure documents, and open the matter draft workflow to start review." : "Draft workspaces will appear here when a permitted matter enters draft review."}
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

