import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app/app-shell";
import { MigrationIntelActions } from "@/components/app/migration-intel-actions";
import { MigrationIntelReviewButton } from "@/components/app/migration-intel-review-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { prisma } from "@/lib/prisma";
import { getAiConfigStatus, getCronConfigStatus } from "@/lib/services/runtime-config";
import { hasFirmWideAccess, hasPermission, scopedMatterWhere } from "@/lib/services/roles";

function formatDate(value: Date | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

function canViewSourceLink(url: string | null | undefined) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function buildQueryString(
  current: Record<string, string | string[] | undefined> | undefined,
  next: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  if (current) {
    for (const [key, value] of Object.entries(current)) {
      if (typeof value === "string" && value) params.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(next)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default async function UpdatesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Migration intelligence">
        <div className="space-y-6">
          <PageHeader
            eyebrow="INTEL"
            title="Migration intelligence"
            description="Create or join a workspace to review migration intelligence and source-linked update impacts."
          />
          <EmptyState title="Workspace setup required" description="Sign in to a workspace to view migration intelligence and affected-matter review." />
        </div>
      </AppShell>
    );
  }

  const canViewUpdates =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_access_update_monitor");
  const canViewAllIntel = hasFirmWideAccess(context.user);

  if (!canViewUpdates) {
    return (
      <AppShell title="Migration intelligence">
        <div className="space-y-6">
          <PageHeader
            eyebrow="INTEL"
            title="Migration intelligence unavailable"
            description="Your company administrator controls who can view migration intelligence and affected matter impacts."
          />
          <EmptyState
            title="Update monitor access is disabled"
            description="Ask a Company Owner or Access Administrator to enable migration intelligence access for your account."
          />
        </div>
      </AppShell>
    );
  }

  const severityFilter = typeof searchParams?.severity === "string" ? searchParams.severity : "ALL";
  const sourceTypeFilter = typeof searchParams?.sourceType === "string" ? searchParams.sourceType : "ALL";
  const subclassFilter = typeof searchParams?.subclass === "string" ? searchParams.subclass.trim() : "";
  const reviewFilter = typeof searchParams?.review === "string" ? searchParams.review : "ALL";
  const tabFilter =
    typeof searchParams?.tab === "string" && ["intel", "official", "notes"].includes(searchParams.tab)
      ? searchParams.tab
      : "intel";
  const aiConfig = getAiConfigStatus();
  const cronConfig = getCronConfigStatus();

  const visibleWhere: Prisma.OfficialUpdateWhereInput = {
    AND: [
      {
        isArchived: false,
        OR: [{ workspaceId: null }, { workspaceId: context.workspace.id }]
      },
      {
        OR: canViewAllIntel
          ? [{ workspaceId: context.workspace.id }, { workspaceId: null }]
          : [
              { workspaceId: context.workspace.id },
              { workspaceId: null, impacts: { some: { matter: scopedMatterWhere(context.user) } } },
              { workspaceId: null, sourceType: "OFFICIAL" as any }
            ]
      }
    ]
  };

  const [items, workspaceNotesCount, lastSweep] = await Promise.all([
    prisma.officialUpdate.findMany({
      where: visibleWhere,
      include: {
        reviewedByUser: true,
        impacts: {
          where: { matter: scopedMatterWhere(context.user) },
          include: { matter: { include: { client: true } } }
        }
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 80
    }) as Promise<any[]>,
    prisma.officialUpdate.count({
      where: {
        workspaceId: context.workspace.id,
        sourceType: "FIRM_NOTE",
        isArchived: false
      }
    }),
    prisma.migrationIntelSweep.findFirst({
      where: {
        OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }],
        status: "COMPLETED"
      },
      orderBy: { startedAt: "desc" }
    })
  ]);

  const filteredItems = items.filter((item) => {
    if (tabFilter === "notes" && item.sourceType !== "FIRM_NOTE") return false;
    if (tabFilter === "official" && item.sourceType !== "OFFICIAL") return false;
    if (tabFilter === "intel" && !["NEWS", "AI_SUMMARY"].includes(String(item.sourceType))) return false;
    if (severityFilter !== "ALL" && item.severity !== severityFilter) return false;
    if (sourceTypeFilter !== "ALL" && item.sourceType !== sourceTypeFilter) return false;
    if (reviewFilter === "REVIEWED" && !item.reviewedAt) return false;
    if (reviewFilter === "UNREVIEWED" && item.reviewedAt) return false;
    if (subclassFilter) {
      const subclasses = Array.isArray(item.affectedSubclassesJson) ? item.affectedSubclassesJson.map(String) : [];
      if (!subclasses.some((code: string) => code.toLowerCase().includes(subclassFilter.toLowerCase()))) return false;
    }
    return true;
  });

  const uniqueSubclasses = Array.from(
    new Set(
      items.flatMap((item) =>
        Array.isArray(item.affectedSubclassesJson) ? item.affectedSubclassesJson.map(String) : []
      )
    )
  ).sort();

  const canSweep =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_run_update_sweep");
  const canLog =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_log_updates");
  const canReview =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_review_update_impacts");
  const intelCount = items.filter((item) => ["NEWS", "AI_SUMMARY"].includes(String(item.sourceType))).length;
  const officialCount = items.filter((item) => item.sourceType === "OFFICIAL").length;
  const configWarnings = [
    !aiConfig.configured
      ? "AI classification is not configured. Aria can still fetch Google News RSS migration items, but severity summaries and subclass classification will fall back to limited keyword review."
      : null,
    !cronConfig.configured
      ? "CRON_SECRET is missing. Scheduled migration intelligence sweeps are disabled."
      : null
  ].filter((value): value is string => Boolean(value));

  return (
    <AppShell title="Migration intelligence">
      <div className="space-y-6">
        <PageHeader
          eyebrow="INTEL"
          title="Migration intelligence"
          description="Aria monitors Australian visa news and official updates, classifies severity, and highlights affected matters."
          action={<MigrationIntelActions canSweep={canSweep} canLog={canLog} />}
        />

        {configWarnings.length ? (
          <SectionCard className="border-amber-400/20 bg-amber-400/10">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200">Configuration required</p>
              {configWarnings.map((warning) => (
                <p key={warning} className="text-sm leading-7 text-amber-100">
                  {warning}
                </p>
              ))}
            </div>
          </SectionCard>
        ) : null}

        <div className="flex flex-wrap items-center gap-8 border-b border-white/8 pb-4">
          <Link
            href={`/app/updates${buildQueryString(searchParams, { tab: "intel" })}` as any}
            className={`border-b-2 pb-3 text-sm font-medium transition ${tabFilter === "intel" ? "border-cyan-400 text-cyan-300" : "border-transparent text-slate-400 hover:text-white"}`}
          >
            Migration Intel - {intelCount}
          </Link>
          <Link
            href={`/app/updates${buildQueryString(searchParams, { tab: "official" })}` as any}
            className={`border-b-2 pb-3 text-sm font-medium transition ${tabFilter === "official" ? "border-cyan-400 text-cyan-300" : "border-transparent text-slate-400 hover:text-white"}`}
          >
            Official Updates - {officialCount}
          </Link>
          <Link
            href={`/app/updates${buildQueryString(searchParams, { tab: "notes" })}` as any}
            className={`border-b-2 pb-3 text-sm font-medium transition ${tabFilter === "notes" ? "border-cyan-400 text-cyan-300" : "border-transparent text-slate-400 hover:text-white"}`}
          >
            Workspace notes - {workspaceNotesCount}
          </Link>
          <div className="ml-auto text-sm text-slate-500">
            Last sync: {lastSweep ? `${formatDate(lastSweep.completedAt ?? lastSweep.startedAt)}, ${new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(lastSweep.completedAt ?? lastSweep.startedAt)}` : "Not yet run"}
          </div>
        </div>

        <SectionCard>
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <label className="space-y-2 text-sm font-medium text-slate-200">
              <span>Severity</span>
              <select name="severity" defaultValue={severityFilter} className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15">
                {["ALL", "INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                  <option key={value} value={value}>{value === "ALL" ? "All severities" : value}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-200">
              <span>Subclass</span>
              <select name="subclass" defaultValue={subclassFilter} className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15">
                <option value="">All subclasses</option>
                {uniqueSubclasses.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-200">
              <span>Source type</span>
              <select name="sourceType" defaultValue={sourceTypeFilter} className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15">
                {["ALL", "OFFICIAL", "NEWS", "FIRM_NOTE", "AI_SUMMARY"].map((value) => (
                  <option key={value} value={value}>{value === "ALL" ? "All source types" : value}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-200">
              <span>Review state</span>
              <select name="review" defaultValue={reviewFilter} className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15">
                <option value="ALL">All review states</option>
                <option value="UNREVIEWED">Unreviewed</option>
                <option value="REVIEWED">Reviewed</option>
              </select>
            </label>
            <div className="flex items-end">
              <button className="inline-flex h-11 w-full items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">
                Apply filters
              </button>
            </div>
          </form>
        </SectionCard>

        {filteredItems.length ? (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const tags = Array.isArray(item.tagsJson) ? item.tagsJson.map(String) : [];
              const subclasses = Array.isArray(item.affectedSubclassesJson) ? item.affectedSubclassesJson.map(String) : [];
              return (
                <SectionCard key={item.id} className="border-cyan-400/20">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusPill tone={item.severity === "CRITICAL" || item.severity === "HIGH" ? "danger" : item.severity === "MEDIUM" ? "warning" : "info"}>
                          {item.severity}
                        </StatusPill>
                        <StatusPill>{String(item.sourceType || "NEWS").replace(/_/g, " ")}</StatusPill>
                        <p className="text-sm text-slate-400">
                          {(item.source || "Unknown source")} - {formatDate(item.publishedAt ?? item.fetchedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                        {item.reviewedAt ? <span>Reviewed {formatDate(item.reviewedAt)}</span> : <span>Review pending</span>}
                        {canViewSourceLink(item.sourceUrl) ? (
                          <a href={item.sourceUrl} target="_blank" className="text-cyan-300 transition hover:text-white">
                            Open source
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <Link href={`/app/updates/${item.id}` as any} className="text-2xl font-semibold tracking-tight text-white transition hover:text-cyan-200">
                        {item.title}
                      </Link>
                      <p className="mt-3 max-w-5xl text-base leading-8 text-slate-300">{item.summary}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {tags.map((tag: string) => (
                        <span key={tag} className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
                          {tag}
                        </span>
                      ))}
                      {subclasses.map((code: string) => (
                        <span key={code} className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                          Subclass {code}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-4">
                      <div className="text-sm text-slate-400">
                        {item.impacts.length} affected matter impact{item.impacts.length === 1 ? "" : "s"} currently linked
                      </div>
                      <div className="flex items-center gap-3">
                        {item.reviewedByUser ? <span className="text-xs text-emerald-300">Reviewed by {item.reviewedByUser.name}</span> : null}
                        {canReview ? <MigrationIntelReviewButton updateId={item.id} reviewed={Boolean(item.reviewedAt)} /> : null}
                      </div>
                    </div>
                  </div>
                </SectionCard>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={items.length ? "No migration intelligence matched these filters" : "No migration intelligence yet"}
            description={
              items.length
                ? "Change the current filters, log a workspace update, or run another live sweep to refresh migration intelligence."
                : "No migration intelligence yet. Run Sweep now to fetch current Australian migration updates."
            }
          />
        )}
      </div>
    </AppShell>
  );
}
