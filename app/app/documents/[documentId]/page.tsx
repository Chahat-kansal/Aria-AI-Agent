import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getDocumentDetailData } from "@/lib/data/workspace-repository";
import Link from "next/link";
import { getDocumentIntelligence } from "@/lib/services/aria-intelligence";

export default async function DocumentDetailPage({ params }: { params: { documentId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return <AppShell title="Documents"><PageHeader title="Workspace setup required" subtitle="Create or join a workspace to review documents." /></AppShell>;

  const document = await getDocumentDetailData(context.workspace.id, params.documentId, context.user);
  if (!document) notFound();

  const extraction = document.extractionResults[0]?.extractedJson as any;
  const intelligence = await getDocumentIntelligence(document);

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
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/api/documents/${document.id}/download` as any} className="rounded-lg border border-border bg-white/70 px-3 py-2 text-sm text-accent">Secure download</Link>
            {document.checklistItems[0] ? <span className="rounded-lg border border-border bg-white/70 px-3 py-2 text-sm text-muted">Checklist: {document.checklistItems[0].label}</span> : null}
          </div>
          <p className="mt-3 text-xs text-muted">Secure download is served through the application. No public file URL is exposed.</p>
        </Card>
        <Card>
          <h3 className="font-semibold">Processing state</h3>
          <div className="mt-3 flex gap-2"><StatusChip label={formatEnum(document.extractionStatus)} /><StatusChip label={formatEnum(document.reviewStatus)} /></div>
          <p className="mt-3 text-sm text-muted">Uploaded by {document.uploadedByUser.name}</p>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h3 className="font-semibold">Aria document intelligence</h3>
          <p className="mt-1 text-sm text-muted">Grounded summary from stored extraction, evidence links, checklist links, and document metadata. Review remains required before relying on this file.</p>
          <p className="mt-4 rounded-xl border border-border bg-white/55 p-4 text-sm leading-7">{intelligence.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Extracted fields</p>
              <p className="mt-2 font-medium">{intelligence.extractedFieldCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">OCR quality</p>
              <p className="mt-2 font-medium">{intelligence.weakOcr ? "Weak / needs manual review" : "Readable preview available"}</p>
            </div>
            <div className="rounded-xl border border-border bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Category suggestion</p>
              <p className="mt-2 font-medium">{intelligence.categorySuggestion ?? "Current category looks reasonable"}</p>
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold">Evidence quality checks</h3>
          <div className="mt-3 space-y-3 text-sm text-muted">
            <div className="rounded-xl border border-border bg-white/55 p-4">
              <p className="font-medium text-[#182033]">Weaknesses to review</p>
              <ul className="mt-2 space-y-2">
                {intelligence.weakEvidence.length ? intelligence.weakEvidence.map((item) => (
                  <li key={item} className="rounded-lg border border-border bg-white/70 p-3">{item}</li>
                )) : <li className="rounded-lg border border-border bg-white/70 p-3">No major extraction weakness is obvious from the stored record.</li>}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-white/55 p-4">
              <p className="font-medium text-[#182033]">Checklist links</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {intelligence.checklistLinks.length ? intelligence.checklistLinks.map((item) => (
                  <span key={item} className="rounded-full border border-border bg-white/80 px-3 py-1.5">{item}</span>
                )) : <span className="rounded-lg border border-border bg-white/80 px-3 py-2">No checklist item is linked yet.</span>}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white/55 p-4">
              <p className="font-medium text-[#182033]">Draft field links</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {intelligence.draftLinks.length ? intelligence.draftLinks.map((item) => (
                  <span key={item} className="rounded-full border border-border bg-white/80 px-3 py-1.5">{item}</span>
                )) : <span className="rounded-lg border border-border bg-white/80 px-3 py-2">No draft field link is recorded yet.</span>}
              </div>
            </div>
          </div>
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
          {intelligence.weakOcr ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">The stored preview is weak, so Aria is intentionally not overstating what this file contains. Confirm the original upload manually before using it as evidence.</p> : null}
        </Card>
      </section>
    </AppShell>
  );
}
