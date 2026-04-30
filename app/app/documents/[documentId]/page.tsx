import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { StatusPill } from "@/components/ui/status-pill";
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
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Document vault</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Stored file metadata</h3>
            </div>
            <StatusPill tone="info">{document.category}</StatusPill>
          </div>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <p className="aria-note">Category<br /><span className="text-white">{document.category}</span></p>
            <p className="aria-note">MIME type<br /><span className="text-white">{document.mimeType}</span></p>
            <p className="aria-note">Size<br /><span className="text-white">{document.fileSize ? `${Math.round(document.fileSize / 1024)} KB` : "Not recorded"}</span></p>
            <p className="aria-note">Uploaded<br /><span className="text-white">{formatDate(document.createdAt)}</span></p>
            <p className="aria-note">Storage provider<br /><span className="text-white">{document.storageObject?.provider ?? "metadata only"}</span></p>
            <p className="aria-note">Content hash<br /><span className="break-all text-white">{document.contentHash ?? "Not recorded"}</span></p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/api/documents/${document.id}/download` as any} className="aria-chip-link">Secure download</Link>
            {document.checklistItems[0] ? <span className="aria-chip">Checklist: {document.checklistItems[0].label}</span> : null}
          </div>
          <p className="mt-3 text-xs text-slate-400">Secure download is served through the application. No public file URL is exposed.</p>
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Processing state</h3>
          <div className="mt-3 flex gap-2"><StatusChip label={formatEnum(document.extractionStatus)} /><StatusChip label={formatEnum(document.reviewStatus)} /></div>
          <p className="mt-3 text-sm text-slate-300">Uploaded by {document.uploadedByUser.name}</p>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Aria document intelligence</h3>
          <p className="mt-1 text-sm text-slate-300">Grounded summary from stored extraction, evidence links, checklist links, and document metadata. Review remains required before relying on this file.</p>
          <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-slate-200">{intelligence.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="aria-surface p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Extracted fields</p>
              <p className="mt-2 font-medium text-white">{intelligence.extractedFieldCount}</p>
            </div>
            <div className="aria-surface p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">OCR quality</p>
              <p className="mt-2 font-medium text-white">{intelligence.weakOcr ? "Weak / needs manual review" : "Readable preview available"}</p>
            </div>
            <div className="aria-surface p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Category suggestion</p>
              <p className="mt-2 font-medium text-white">{intelligence.categorySuggestion ?? "Current category looks reasonable"}</p>
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Evidence quality checks</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-medium text-white">Weaknesses to review</p>
              <ul className="mt-2 space-y-2">
                {intelligence.weakEvidence.length ? intelligence.weakEvidence.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">{item}</li>
                )) : <li className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">No major extraction weakness is obvious from the stored record.</li>}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-medium text-white">Checklist links</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {intelligence.checklistLinks.length ? intelligence.checklistLinks.map((item) => (
                  <span key={item} className="aria-chip">{item}</span>
                )) : <span className="aria-chip">No checklist item is linked yet.</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-medium text-white">Draft field links</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {intelligence.draftLinks.length ? intelligence.draftLinks.map((item) => (
                  <span key={item} className="aria-chip">{item}</span>
                )) : <span className="aria-chip">No draft field link is recorded yet.</span>}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Extracted fields</h3>
          <div className="mt-3 space-y-2">
            {document.extractedFields.length ? document.extractedFields.map((field) => (
              <div key={field.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                <div className="flex items-center justify-between gap-3"><p className="font-medium text-white">{field.fieldLabel}</p><StatusChip label={formatEnum(field.status)} /></div>
                <p className="mt-1 text-slate-300">{field.fieldValue}</p>
                <p className="mt-1 text-xs text-slate-400">Confidence {Math.round(field.confidence * 100)}% - {field.sourceSnippet}</p>
              </div>
            )) : <p className="text-sm text-slate-400">No extracted fields recorded for this document.</p>}
          </div>
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Text preview</h3>
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            {extraction?.extractedTextPreview || "No readable text preview was available from this file. Review the original document manually."}
          </p>
          {intelligence.weakOcr ? <p className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-300">The stored preview is weak, so Aria is intentionally not overstating what this file contains. Confirm the original upload manually before using it as evidence.</p> : null}
        </Card>
      </section>
    </AppShell>
  );
}
