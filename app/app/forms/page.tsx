import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getVisaSubclassOptions } from "@/lib/services/visa-knowledge";
import { prisma } from "@/lib/prisma";

export default async function FormsPage() {
  const context = await getCurrentWorkspaceContext();
  const matters = context
    ? await prisma.matter.findMany({
        where: { workspaceId: context.workspace.id },
        include: { client: true, applicationDrafts: true },
        orderBy: { updatedAt: "desc" }
      })
    : [];
  const visaOptions = await getVisaSubclassOptions();
  const configuredTemplates = context
    ? await prisma.visaSubclassTemplate.findMany({ where: { OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }], active: true } })
    : [];
  const configuredSubclassCodes = new Set(configuredTemplates.map((template) => template.subclassCode));

  return (
    <AppShell title="Forms & Field Review">
      <PageHeader title="Draft Application Review" subtitle="Open configured source-linked draft workflows. Broader visa knowledge is available where official records have been ingested." />
      <section className="mb-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h3 className="font-semibold">Configured draft templates</h3>
          <p className="mt-2 text-sm text-muted">
            Subclass 500 is currently configured for field-level draft filling, evidence linking, validation, package review, and client confirmation.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            {configuredTemplates.length ? configuredTemplates.map((template) => (
              <span key={template.id} className="rounded-full border border-border px-3 py-1">Subclass {template.subclassCode} {template.stream ?? ""}</span>
            )) : <span>No draft templates are configured yet.</span>}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold">All-visa knowledge coverage</h3>
          <p className="mt-2 text-sm text-muted">
            {visaOptions.length ? `${visaOptions.length} official subclass records are stored for research and matter intake.` : "No broader visa knowledge is stored yet. Refresh official visa knowledge before relying on all-visa research."}
          </p>
          <Link href="/app/knowledge" className="mt-3 inline-flex rounded-lg border border-border px-3 py-2 text-sm text-accent">Open visa knowledge</Link>
        </Card>
      </section>
      <Card>
        {matters.length ? (
          <div className="space-y-3">
            {matters.map((matter) => {
              const configured = configuredSubclassCodes.has(matter.visaSubclass);
              return (
                <Link key={matter.id} href={configured ? `/app/matters/${matter.id}/draft` : `/app/matters/${matter.id}`} className="block rounded-xl border border-border p-3 transition hover:bg-[#0f1727]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{matter.client.firstName} {matter.client.lastName}</p>
                      <p className="text-xs text-muted">{matter.title} - Subclass {matter.visaSubclass} - {matter.visaStream}</p>
                    </div>
                    <div className="text-right text-xs text-muted">
                      <p>{configured ? (matter.applicationDrafts.length ? "Draft started" : "Draft ready to start") : "Template not yet configured"}</p>
                      <p>Readiness {matter.readinessScore}%</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">No matters found in this workspace. Create a matter to start a source-linked draft review.</p>
        )}
      </Card>
    </AppShell>
  );
}
