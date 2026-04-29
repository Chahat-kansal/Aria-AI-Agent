import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
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
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Visa checklist</h3>
            <p className="mt-1 text-sm text-muted">Supported subclasses currently include 500, 482, 186, 189, 190, 491, 600, and Partner 820/801.</p>
          </div>
          {hasPermission(context.user, "can_edit_matters") ? (
            <form action={handleGenerate}>
              <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
                {matter.checklistItems.length ? "Regenerate checklist" : "Generate checklist"}
              </button>
            </form>
          ) : null}
        </div>
      </Card>

      <Card>
        {matter.checklistItems.length ? (
          <div className="space-y-2">
            {matter.checklistItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-white/55 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted">{item.category} - {item.required ? "Required" : "Optional"} - {item.status.toLowerCase()}</p>
                    {item.description ? <p className="mt-1 text-sm text-muted">{item.description}</p> : null}
                  </div>
                  <div className="text-right text-xs text-muted">
                    {item.document ? <p>Linked file: {item.document.fileName}</p> : <p>No document linked yet</p>}
                    {item.dueDate ? <p>Due: {item.dueDate.toLocaleDateString("en-AU")}</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No checklist items exist yet. Generate the real checklist for this visa matter to start requesting documents.</p>
        )}
      </Card>

      <Card className="mt-4">
        <h3 className="font-semibold">Next actions</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={"/app/document-requests" as any} className="rounded-lg border border-border bg-white/70 px-4 py-2 text-sm text-accent">Open document requests</Link>
          <Link href={`/app/matters/${matter.id}/draft` as any} className="rounded-lg border border-border bg-white/70 px-4 py-2 text-sm text-accent">Open draft review</Link>
        </div>
      </Card>
    </AppShell>
  );
}
