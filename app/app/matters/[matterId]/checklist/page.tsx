import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PrimaryButton } from "@/components/ui/primary-button";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { generateChecklistForMatter } from "@/lib/services/client-workflows";

export default async function MatterChecklistPage({ params }: { params: { matterId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  const matter = await prisma.matter.findFirst({
    where: { id: params.matterId, workspaceId: context.workspace.id },
    include: { assignedToUser: true, client: true, checklistItems: { include: { document: true }, orderBy: { label: "asc" } } }
  });
  if (!matter || !canAccessMatter(context.user, matter)) notFound();

  async function handleGenerate() {
    "use server";
    await generateChecklistForMatter(params.matterId, context.user.id);
    revalidatePath(`/app/matters/${params.matterId}/checklist`);
    revalidatePath(`/app/matters/${params.matterId}`);
  }

  return (
    <AppShell title="Matters">
      <PageHeader title={`Checklist - ${matter.client.firstName} ${matter.client.lastName}`} subtitle="Real visa checklist records linked to the matter, document uploads, and client request workflows." />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-white">Visa checklist</h3>
            <p className="mt-1 text-sm text-slate-300">Supported subclasses currently include 500, 482, 186, 189, 190, 491, 600, and Partner 820/801.</p>
          </div>
          {hasPermission(context.user, "can_edit_matters") ? (
            <form action={handleGenerate}>
              <PrimaryButton>
                {matter.checklistItems.length ? "Regenerate checklist" : "Generate checklist"}
              </PrimaryButton>
            </form>
          ) : null}
        </div>
      </Card>

      <Card>
        {matter.checklistItems.length ? (
          <div className="space-y-2">
            {matter.checklistItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.category} - {item.required ? "Required" : "Optional"} - {item.status.toLowerCase()}</p>
                    {item.description ? <p className="mt-1 text-sm text-slate-300">{item.description}</p> : null}
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    {item.document ? <p>Linked file: {item.document.fileName}</p> : <p>No document linked yet</p>}
                    {item.dueDate ? <p>Due: {item.dueDate.toLocaleDateString("en-AU")}</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No checklist items yet"
            description="Generate the real checklist for this visa matter to start requesting documents."
          />
        )}
      </Card>

      <Card className="mt-6">
        <h3 className="text-xl font-semibold tracking-tight text-white">Next actions</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={"/app/document-requests" as any} className="aria-chip-link">Open document requests</Link>
          <Link href={`/app/matters/${matter.id}/draft` as any} className="aria-chip-link">Open draft review</Link>
        </div>
      </Card>
    </AppShell>
  );
}
