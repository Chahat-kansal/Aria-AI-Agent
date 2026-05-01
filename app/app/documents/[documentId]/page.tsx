import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { AIInsightPanel } from "@/components/ui/ai-insight-panel";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate, formatEnum, getDocumentDetailData } from "@/lib/data/workspace-repository";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getDocumentIntelligence } from "@/lib/services/aria-intelligence";

export default async function DocumentDetailPage({ params }: { params: { documentId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Documents">
        <div className="space-y-6">
          <PageHeader title="Workspace setup required" description="Create or join a workspace to review documents." />
        </div>
      </AppShell>
    );
  }

  const document = await getDocumentDetailData(context.workspace.id, params.documentId, context.user);
  if (!document) notFound();

  const extraction = document.extractionResults[0]?.extractedJson as any;
  const intelligence = await getDocumentIntelligence(document);

  return (
    <AppShell title="Documents">
      <div className="space-y-8">
        <PageHeader
          eyebrow="DOCUMENT INTELLIGENCE"
          title={document.fileName}
          description={`${document.matter.client.firstName} ${document.matter.client.lastName} - ${document.matter.title}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info">{document.category}</StatusPill>
              <StatusPill>{formatEnum(document.extractionStatus)}</StatusPill>
              <StatusPill tone={document.reviewStatus === "VERIFIED" ? "success" : document.reviewStatus === "FLAGGED" ? "danger" : "warning"}>
                {formatEnum(document.reviewStatus)}
              </StatusPill>
            </div>
          }
        />

        <AIInsightPanel
          eyebrow="Aria document review"
          title="Readable evidence, secure handling, and review-required extraction"
          summary={intelligence.summary}
          statusLabel={intelligence.weakOcr ? "Weak OCR" : "Review required"}
          action={<Link href={`/api/documents/${document.id}/download`} className="inline-flex h-10 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">Secure download</Link>}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <SectionCard className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Extracted fields</p>
              <p className="mt-2 text-sm text-white">{intelligence.extractedFieldCount}</p>
            </SectionCard>
            <SectionCard className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">OCR quality</p>
              <p className="mt-2 text-sm text-white">{intelligence.weakOcr ? "Weak or unavailable" : "Readable preview available"}</p>
            </SectionCard>
            <SectionCard className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Category suggestion</p>
              <p className="mt-2 text-sm text-white">{intelligence.categorySuggestion ?? "Current category looks reasonable"}</p>
            </SectionCard>
          </div>
        </AIInsightPanel>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-6">
            <PageSection title="Document metadata" description="Stored metadata and extraction previews are shown here without exposing public file URLs.">
              <SectionCard className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Category</p>
                  <p className="mt-2 text-sm text-white">{document.category}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">MIME type</p>
                  <p className="mt-2 text-sm text-white">{document.mimeType}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">File size</p>
                  <p className="mt-2 text-sm text-white">{document.fileSize ? `${Math.round(document.fileSize / 1024)} KB` : "Not recorded"}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Uploaded</p>
                  <p className="mt-2 text-sm text-white">{formatDate(document.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Storage provider</p>
                  <p className="mt-2 text-sm text-white">{document.storageObject?.provider ?? "Metadata only"}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Content hash</p>
                  <p className="mt-2 break-all text-sm text-white">{document.contentHash ?? "Not recorded"}</p>
                </div>
              </SectionCard>
            </PageSection>

            <PageSection title="Extracted text preview" description="Aria only shows stored OCR/extraction output. If the provider was weak or unavailable, the warning remains explicit.">
              <SectionCard className="space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-sm leading-7 text-slate-300">
                    {extraction?.extractedTextPreview || "No readable text preview was available from this file. Review the original document manually."}
                  </p>
                </div>
                {intelligence.weakOcr ? <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-300">The stored preview is weak, so Aria is intentionally not overstating what this file contains. Confirm the original upload manually before using it as evidence.</p> : null}
              </SectionCard>
            </PageSection>

            <PageSection title="Extracted fields" description="Field-level extraction remains source-linked and review-required.">
              <div className="grid gap-4">
                {document.extractedFields.length ? document.extractedFields.map((field) => (
                  <SectionCard key={field.id} className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{field.fieldLabel}</p>
                        <p className="mt-2 text-sm text-slate-200">{field.fieldValue}</p>
                      </div>
                      <StatusPill tone={field.status === "VERIFIED" ? "success" : field.status === "CONFLICTING" ? "danger" : "warning"}>
                        {formatEnum(field.status)}
                      </StatusPill>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Confidence</p>
                        <p className="mt-2 text-sm text-slate-200">{Math.round(field.confidence * 100)}%</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Source snippet</p>
                        <p className="mt-2 text-sm text-slate-200">{field.sourceSnippet || "No source snippet recorded."}</p>
                      </div>
                    </div>
                  </SectionCard>
                )) : <SectionCard><p className="text-sm text-slate-400">No extracted fields recorded for this document.</p></SectionCard>}
              </div>
            </PageSection>
          </div>

          <div className="space-y-6">
            <PageSection title="Matter links">
              <SectionCard className="space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Matter</p>
                  <p className="mt-2 text-sm font-medium text-white">{document.matter.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{document.matter.client.firstName} {document.matter.client.lastName}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Uploaded by</p>
                  <p className="mt-2 text-sm text-white">{document.uploadedByUser.name ?? document.uploadedByUser.email}</p>
                </div>
              </SectionCard>
            </PageSection>

            <PageSection title="Evidence quality checks">
              <SectionCard className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-white">Weaknesses to review</p>
                  <ul className="mt-3 space-y-2">
                    {intelligence.weakEvidence.length ? intelligence.weakEvidence.map((item) => (
                      <li key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">{item}</li>
                    )) : <li className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">No major extraction weakness is obvious from the stored record.</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Checklist links</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {intelligence.checklistLinks.length ? intelligence.checklistLinks.map((item) => (
                      <StatusPill key={item} tone="info">{item}</StatusPill>
                    )) : <StatusPill>No checklist item linked yet</StatusPill>}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Draft field links</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {intelligence.draftLinks.length ? intelligence.draftLinks.map((item) => (
                      <StatusPill key={item}>{item}</StatusPill>
                    )) : <StatusPill>No draft field link recorded yet</StatusPill>}
                  </div>
                </div>
              </SectionCard>
            </PageSection>

            <PageSection title="Secure handling">
              <SectionCard className="space-y-3">
                <p className="text-sm text-slate-300">Secure download is served through the application. No public file URL is exposed for this document.</p>
                <Link href={`/api/documents/${document.id}/download`} className="inline-flex h-10 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">
                  Download original securely
                </Link>
              </SectionCard>
            </PageSection>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
