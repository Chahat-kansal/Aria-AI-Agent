import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getBuildInfoSummary } from "@/lib/services/platform-admin-data";

export default async function AdminDeploymentsPage() {
  const info = await getBuildInfoSummary();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="DEPLOYMENTS" title="Deployment status" description="Deployment metadata only. No environment values or secrets are displayed." />
      <SectionCard>
        <pre className="rounded-2xl bg-[color:var(--surface-soft)] p-4 text-sm">{JSON.stringify(info, null, 2)}</pre>
      </SectionCard>
    </div>
  );
}

