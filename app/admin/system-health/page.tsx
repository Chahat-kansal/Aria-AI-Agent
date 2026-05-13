import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getBuildInfoSummary, getPlatformRuntimeStatus } from "@/lib/services/platform-admin-data";
import { prisma } from "@/lib/prisma";

export default async function AdminSystemHealthPage() {
  const [buildInfo, workspaceCount] = await Promise.all([getBuildInfoSummary(), prisma.workspace.count()]);
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
    </div>
  );
}

