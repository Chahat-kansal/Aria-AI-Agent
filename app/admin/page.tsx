import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getPlatformOverview } from "@/lib/services/platform-admin-data";

export default async function PlatformAdminPage() {
  const data = await getPlatformOverview();
  const runtime = data.runtime;
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="PLATFORM ADMIN"
        title="Operational overview"
        description="Platform-wide controls and health signals. Client, document, extraction, and draft content are intentionally not shown."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Workspaces" value={data.counts.totalWorkspaces} hint={`${data.counts.trialWorkspaces} starter/trial workspaces`} accent="violet" />
        <MetricCard label="Active Users" value={data.counts.activeUsers} hint={`${data.counts.disabledUsers} disabled users`} accent="emerald" />
        <MetricCard label="Matters" value={data.counts.totalMatters} hint="Count only, no matter titles" accent="cyan" />
        <MetricCard label="Documents" value={data.counts.totalDocuments} hint="Count only, no filenames/content" accent="amber" />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <h2 className="text-lg font-semibold">Runtime configuration</h2>
          <div className="mt-4 grid gap-2">
            {[
              ["Encryption", runtime.encryption.configured],
              ["AI", runtime.ai.configured],
              ["Cron", runtime.cron.configured],
              ["Email", runtime.email.configured],
              ["Database", runtime.database.configured]
            ].map(([label, ok]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-2xl bg-[color:var(--surface-soft)] p-3 text-sm">
                <span>{label}</span>
                <StatusPill tone={ok ? "success" : "warning"}>{ok ? "configured" : "needs attention"}</StatusPill>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard>
          <h2 className="text-lg font-semibold">Deployment</h2>
          <div className="mt-4 space-y-2 text-sm text-[color:var(--text-secondary)]">
            <p>Root: {data.buildInfo.root}</p>
            <p>Environment: {data.buildInfo.environment}</p>
            <p>Commit: {data.buildInfo.commit}</p>
            <p>Vercel URL: {data.buildInfo.vercelUrl}</p>
          </div>
        </SectionCard>
      </section>
      <SectionCard>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent redacted audit events</h2>
          <Link href={"/admin/audit" as any} className="text-sm font-medium text-violet-400">Open audit</Link>
        </div>
        <div className="mt-4 divide-y divide-white/5">
          {data.recentAudit.map((event) => (
            <div key={event.id} className="grid gap-2 py-3 text-sm md:grid-cols-[180px_1fr_180px]">
              <span className="text-[color:var(--text-tertiary)]">{event.createdAt.toLocaleString("en-AU")}</span>
              <span>{event.action}</span>
              <span className="text-[color:var(--text-tertiary)]">{event.workspaceName}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
