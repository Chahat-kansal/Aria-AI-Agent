import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { GeneratedDocumentForm } from "@/components/app/generated-document-form";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export default async function GeneratedDocumentsPage({ params }: { params: { matterId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  const matter = await prisma.matter.findFirst({
    where: { id: params.matterId, workspaceId: context.workspace.id },
    include: { assignedToUser: true, client: true, generatedDocuments: { orderBy: { createdAt: "desc" }, include: { createdByUser: true } } }
  });
  if (!matter || !canAccessMatter(context.user, matter)) notFound();

  return (
    <AppShell title="Matters">
      <PageHeader title={`Generated documents - ${matter.client.firstName} ${matter.client.lastName}`} subtitle="Create AI-assisted matter documents and templates. Review required before client use or submission." />
      {hasPermission(context.user, "can_generate_documents") ? (
        <Card className="mb-4">
          <h3 className="font-semibold">Generate a document</h3>
          <p className="mb-3 mt-1 text-sm text-muted">Use the live AI provider to draft a document or checklist from the current matter, evidence, and validation context.</p>
          <GeneratedDocumentForm matterId={matter.id} />
        </Card>
      ) : (
        <Card className="mb-4"><p className="text-sm text-muted">You do not currently have permission to generate matter documents.</p></Card>
      )}

      <div className="space-y-4">
        {matter.generatedDocuments.length ? matter.generatedDocuments.map((document) => (
          <Card key={document.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{document.title}</h3>
                <p className="mt-1 text-xs text-muted">Created by {document.createdByUser.name} on {document.createdAt.toLocaleString("en-AU")}</p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Review required</span>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-border bg-white/45 p-4 text-sm text-muted">{document.content}</pre>
          </Card>
        )) : (
          <Card><p className="text-sm text-muted">No generated documents exist for this matter yet.</p></Card>
        )}
      </div>
    </AppShell>
  );
}
