import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getBuildInfoSummary, getPlatformRuntimeStatus } from "@/lib/services/platform-admin-data";
import { getProviderStatuses } from "@/lib/services/provider-status";
import { prisma } from "@/lib/prisma";

export default async function AdminSystemHealthPage() {
  const [buildInfo, workspaceCount, providers] = await Promise.all([getBuildInfoSummary(), prisma.workspace.count(), getProviderStatuses()]);
  const runtime = getPlatformRuntimeStatus();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SYSTEM" title="System health" description="Operational health with no secrets or private client content." />
      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <h2 className="text-lg font-semibold">Build info</h2>
          <div className="mt-4 space-y-2 text-sm">
            <p>Root: {buildInfo.root}</p><p>Environment: {buildInfo.environment}</p><p>Commit: {buildInfo.commit}</p><p>Vercel URL: {buildInfo.vercelUrl}</p>
          </div>
        </SectionCard>
        <SectionCard>
          <h2 className="text-lg font-semibold">Reachability</h2>
          <div className="mt-4 space-y-2 text-sm">
            <p>Database reachable: <StatusPill tone="success">yes</StatusPill></p>
            <p>Workspace count: {workspaceCount}</p>
            <p>AI: <StatusPill tone={runtime.ai.configured ? "success" : "warning"}>{runtime.ai.provider}</StatusPill></p>
            <p>Email: <StatusPill tone={runtime.email.configured ? "success" : "warning"}>{runtime.email.provider}</StatusPill></p>
          </div>
        </SectionCard>
      </section>
      <SectionCard>
        <h2 className="text-lg font-semibold">Provider status</h2>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          Configuration and connection state only. No keys, OAuth tokens, webhook secrets, or connection strings are displayed.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => (
            <div key={provider.key} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-white">{provider.label}</p>
                <StatusPill tone={provider.state === "disabled" ? "neutral" : provider.configured && provider.connected ? "success" : "warning"}>
                  {provider.state === "disabled" ? "Disabled" : provider.configured && provider.connected ? "Configured" : provider.configured ? "Needs connection" : "Not configured"}
                </StatusPill>
              </div>
              <p className="mt-2 text-slate-300">{provider.providerName}</p>
              <p className="mt-2 text-xs text-slate-400">Connection: {provider.connectionState.replaceAll("_", " ")}</p>
              {provider.lastSyncAt ? <p className="mt-1 text-xs text-slate-400">Last sync: {new Date(provider.lastSyncAt).toLocaleString("en-AU")}</p> : null}
              <p className="mt-2 text-xs text-slate-400">
                {provider.missingEnv.length ? `Missing ${provider.missingEnv.join(", ")}` : "No missing environment values recorded."}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Link href={"/admin/integrations" as any} className="text-sm text-cyan-300 hover:text-white">Open integration hub</Link>
        </div>
      </SectionCard>
    </div>
  );
}
