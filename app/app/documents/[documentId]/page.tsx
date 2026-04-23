import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getDocumentDetailData } from "@/lib/data/workspace-repository";

export default async function DocumentDetailPage({ params }: { params: { documentId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return <AppShell title="Documents"><PageHeader title="Workspace setup required" subtitle="Create or join a workspace to review documents." /></AppShell>;

  const document = await getDocumentDetailData(context.workspace.id, params.documentId, context.user);
  if (!document) notFound();

  const extraction = document.extractionResults[0]?.extractedJson as any;

  return (
    <AppShell title="Documents">
      <PageHeader title={document.fileName} subtitle={`${document.matter.client.firstName} ${document.matter.client.lastName} - ${document.matter.title}`} />
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <h3 className="font-semibold">Stored file metadata</h3>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <p className="rounded-lg border border-border bg-white/45 p-3 text-muted">Category<br /><span className="text-[#182033]">{document.category}</span></p>
            <p className="rounded-lg border border-border bg-white/45 p-3 text-muted">MIME type<br /><span className="text-[#182033]">{document.mimeType}</span></p>
            <p className="rounded-lg border border-border bg-white/45 p-3 text-muted">Size<br /><span className="text-[#182033]">{document.fileSize ? `${Math.round(document.fileSize / 1024)} KB` : "Not recorded"}</span></p>
            <p className="rounded-lg border border-border bg-white/45 p-3 text-muted">Uploaded<br /><span className="text-[#182033]">{formatDate(document.createdAt)}</span></p>
            <p className="rounded-lg border border-border bg-white/45 p-3 text-muted">Storage provider<br /><span className="text-[#182033]">{document.storageObject?.provider ?? "metadata only"}</span></p>
            <p className="rounded-lg border border-border bg-white/45 p-3 text-muted">Content hash<br /><span className="break-all text-[#182033]">{document.contentHash ?? "Not recorded"}</span></p>
          </div>
          <p className="mt-3 text-xs text-muted">Document preview is metadata and extracted-text based. Original file delivery can be plugged into the storage provider without changing matter workflows.</p>
        </Card>
        <Card>
          <h3 className="font-semibold">Processing state</h3>
          <div className="mt-3 flex gap-2"><StatusChip label={formatEnum(document.extractionStatus)} /><StatusChip label={formatEnum(document.reviewStatus)} /></div>
          <p className="mt-3 text-sm text-muted">Uploaded by {document.uploadedByUser.name}</p>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Extracted fields</h3>
          <div className="mt-3 space-y-2">
            {document.extractedFields.length ? document.extractedFields.map((field) => (
              <div key={field.id} className="rounded-lg border border-border bg-white/45 p-3 text-sm">
                <div className="flex items-center justify-between"><p className="font-medium">{field.fieldLabel}</p><StatusChip label={formatEnum(field.status)} /></div>
                <p className="mt-1 text-muted">{field.fieldValue}</p>
                <p className="mt-1 text-xs text-muted">Confidence {Math.round(field.confidence * 100)}% - {field.sourceSnippet}</p>
              </div>
            )) : <p className="text-sm text-muted">No extracted fields recorded for this document.</p>}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold">Text preview</h3>
          <p className="mt-3 rounded-lg border border-border bg-white/55 p-3 text-sm text-muted">
            {extraction?.extractedTextPreview || "No readable text preview was available from this file. Review the original document manually."}
          </p>
        </Card>
      </section>
    </AppShell>
  );
}
