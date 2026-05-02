import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { MigrationIntelReviewButton } from "@/components/app/migration-intel-review-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { prisma } from "@/lib/prisma";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";

function formatDate(value: Date | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

export default async function UpdateDetailPage({ params }: { params: { updateId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Migration intelligence">
        <div className="space-y-6">
          <PageHeader eyebrow="INTEL" title="Workspace setup required" description="Create or join a workspace to review migration intelligence items." />
          <EmptyState title="No workspace access" description="Sign in to a workspace to continue." />
        </div>
      </AppShell>
    );
  }

  if (!hasPermission(context.user, "can_access_update_monitor")) {
    return (
      <AppShell title="Migration intelligence">
        <div className="space-y-6">
          <PageHeader eyebrow="INTEL" title="Migration intelligence unavailable" description="Your company administrator controls migration intelligence access." />
          <EmptyState title="Update monitor access is disabled" description="Ask a Company Owner or Access Administrator to enable update monitoring for your account." />
        </div>
      </AppShell>
    );
  }

  const update = await prisma.officialUpdate.findFirst({
    where: {
      id: params.updateId,
      isArchived: false,
      OR: [{ workspaceId: null }, { workspaceId: context.workspace.id }]
    },
    include: {
      officialSource: true,
      reviewedByUser: true,
      impacts: {
        where: { matter: scopedMatterWhere(context.user) },
        include: { matter: { include: { client: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!update) notFound();

  const tags = Array.isArray(update.tagsJson) ? update.tagsJson.map(String) : [];
  const subclasses = Array.isArray(update.affectedSubclassesJson) ? update.affectedSubclassesJson.map(String) : [];
  const canReview =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_review_update_impacts");

  return (
    <AppShell title="Migration intelligence">
      <div className="space-y-6">
        <PageHeader
          eyebrow="INTEL"
          title={update.title}
          description={`${update.source} · ${update.sourceType} · Published ${formatDate(update.publishedAt)} · Review required before policy or matter changes.`}
          action={
            <div className="flex items-center gap-3">
              <StatusPill tone={update.severity === "CRITICAL" || update.severity === "HIGH" ? "danger" : update.severity === "MEDIUM" ? "warning" : "info"}>
                {update.severity}
              </StatusPill>
              {canReview ? <MigrationIntelReviewButton updateId={update.id} reviewed={Boolean(update.reviewedAt)} /> : null}
            </div>
          }
        />

        <SectionCard>
          <div className="space-y-4">
            <p className="text-base leading-8 text-slate-300">{update.summary}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.02] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Source</p>
                <p className="mt-3 text-sm text-slate-300">{update.source}</p>
                {/^https?:\/\//i.test(update.sourceUrl) ? (
                  <a href={update.sourceUrl} target="_blank" className="mt-3 inline-flex text-sm text-cyan-300 transition hover:text-white">
                    Open source publication
                  </a>
                ) : null}
              </div>
              <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.02] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Review status</p>
                <p className="mt-3 text-sm text-slate-300">
                  {update.reviewedAt ? `Reviewed ${formatDate(update.reviewedAt)}${update.reviewedByUser ? ` by ${update.reviewedByUser.name}` : ""}` : "Not yet reviewed"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
                  {tag}
                </span>
              ))}
              {subclasses.map((code) => (
                <span key={code} className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                  Subclass {code}
                </span>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="text-xl font-semibold tracking-tight text-white">Affected matters</h2>
          <div className="mt-4 space-y-3">
            {update.impacts.length ? update.impacts.map((impact) => (
              <div key={impact.id} className="rounded-[1.35rem] border border-white/8 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/app/matters/${impact.matterId}` as any} className="text-base font-semibold text-cyan-300 transition hover:text-white">
                      {impact.matter.client.firstName} {impact.matter.client.lastName} - {impact.matter.title}
                    </Link>
                    <p className="mt-2 text-sm text-slate-400">{impact.reason}</p>
                    <p className="mt-2 text-sm text-slate-300">{impact.actionRequired ?? "Review this intelligence item against the matter before changing submission assumptions."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone={impact.impactLevel === "HIGH" ? "danger" : impact.impactLevel === "MEDIUM" ? "warning" : "info"}>
                      {impact.impactLevel}
                    </StatusPill>
                    <StatusPill tone="neutral">{impact.status}</StatusPill>
                  </div>
                </div>
              </div>
            )) : (
              <EmptyState title="No affected matters yet" description="Aria has not matched this migration intelligence item to an active matter in your current scope." />
            )}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
