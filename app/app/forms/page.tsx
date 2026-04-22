import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { prisma } from "@/lib/prisma";

export default async function FormsPage() {
  const { workspace } = await getCurrentWorkspaceContext();
  const matters = await prisma.matter.findMany({
    where: { workspaceId: workspace.id, visaSubclass: "500" },
    include: { client: true, applicationDrafts: true },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <AppShell title="Forms & Field Review">
      <PageHeader title="Subclass 500 Draft Application Review" subtitle="Select a real matter to open the source-linked draft application workflow. Client and agent review are required." />
      <Card>
        {matters.length ? (
          <div className="space-y-3">
            {matters.map((matter) => (
              <Link key={matter.id} href={`/app/matters/${matter.id}/draft`} className="block rounded-xl border border-border p-3 transition hover:bg-[#0f1727]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{matter.client.firstName} {matter.client.lastName}</p>
                    <p className="text-xs text-muted">{matter.title} · Subclass {matter.visaSubclass} · {matter.visaStream}</p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>{matter.applicationDrafts.length ? "Draft started" : "Draft not started"}</p>
                    <p>Readiness {matter.readinessScore}%</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No Subclass 500 matters found in this workspace.</p>
        )}
      </Card>
    </AppShell>
  );
}
