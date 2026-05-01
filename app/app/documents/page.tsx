import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { DocumentUploadForm } from "@/components/app/document-upload-form";
import { DataTable, DataTableCell, DataTableHeading, DataTableHeader, DataTableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getDocumentsData, getMattersData } from "@/lib/data/workspace-repository";
import { hasPermission } from "@/lib/services/roles";

const folders = ["Identity", "Travel", "Education", "Employment", "Financial", "Relationship", "Health / Insurance", "Statements / Declarations", "Forms", "Other Evidence"];

export default async function DocumentsPage() {
  const context = await getCurrentWorkspaceContext();
  const documents = context ? await getDocumentsData(context.workspace.id, context.user) : [];
  const matters = context ? await getMattersData(context.workspace.id, context.user) : [];
  const canEditMatter = context ? hasPermission(context.user, "can_edit_matters") : false;
  const categories = new Map<string, number>();
  for (const document of documents) categories.set(document.category, (categories.get(document.category) ?? 0) + 1);

  const needsReviewCount = documents.filter((document) => document.reviewStatus !== "VERIFIED").length;
  const extractedCount = documents.filter((document) => document.extractionStatus === "EXTRACTED").length;
  const linkedCount = documents.filter((document) => Boolean(document.matterId)).length;

  return (
    <AppShell title="Documents">
      <div className="space-y-8">
        <PageHeader
          eyebrow="DOCUMENTS"
          title="Document vault"
          description="Review uploaded evidence, monitor extraction quality, and keep matter-linked files organized inside the secure workspace vault."
        />

        {documents.length ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total documents" value={documents.length} hint="All files visible in your current scope." accent="cyan" />
            <MetricCard label="Needs review" value={needsReviewCount} hint="Files not yet verified for evidence use." accent={needsReviewCount ? "amber" : "emerald"} />
            <MetricCard label="Extraction complete" value={extractedCount} hint="Files with completed extraction status." accent={extractedCount ? "emerald" : "violet"} />
            <MetricCard label="Linked to matters" value={linkedCount} hint="Evidence already tied to a live matter." accent="violet" />
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <PageSection title="Workspace documents" description="Every record here comes from the live matter workflow. Open a document to review extraction, evidence links, and secure download access.">
            {documents.length ? (
              <>
                <DataTable className="hidden lg:block">
                  <table className="w-full text-sm">
                    <DataTableHeader>
                      <tr>
                        <DataTableHeading>File</DataTableHeading>
                        <DataTableHeading>Matter</DataTableHeading>
                        <DataTableHeading>Category</DataTableHeading>
                        <DataTableHeading className="text-center">Extraction</DataTableHeading>
                        <DataTableHeading className="text-center">Review</DataTableHeading>
                        <DataTableHeading className="text-center">Uploaded</DataTableHeading>
                      </tr>
                    </DataTableHeader>
                    <tbody>
                      {documents.map((document) => (
                        <DataTableRow key={document.id}>
                          <DataTableCell>
                            <Link href={`/app/documents/${document.id}`} className="font-medium text-cyan-300 transition hover:text-white">
                              {document.fileName}
                            </Link>
                          </DataTableCell>
                          <DataTableCell>
                            <p className="font-medium text-white">{document.matter.client.firstName} {document.matter.client.lastName}</p>
                            <p className="text-xs text-slate-500">{document.matter.title}</p>
                          </DataTableCell>
                          <DataTableCell>{document.category}</DataTableCell>
                          <DataTableCell className="text-center"><StatusPill>{formatEnum(document.extractionStatus)}</StatusPill></DataTableCell>
                          <DataTableCell className="text-center"><StatusPill tone={document.reviewStatus === "VERIFIED" ? "success" : document.reviewStatus === "FLAGGED" ? "danger" : "warning"}>{formatEnum(document.reviewStatus)}</StatusPill></DataTableCell>
                          <DataTableCell className="text-center text-slate-400">{formatDate(document.createdAt)}</DataTableCell>
                        </DataTableRow>
                      ))}
                    </tbody>
                  </table>
                </DataTable>

                <div className="grid gap-4 lg:hidden">
                  {documents.map((document) => (
                    <SectionCard key={document.id} className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/app/documents/${document.id}`} className="text-base font-semibold text-white">{document.fileName}</Link>
                          <p className="mt-1 text-sm text-slate-400">{document.matter.client.firstName} {document.matter.client.lastName}</p>
                          <p className="text-xs text-slate-500">{document.matter.title}</p>
                        </div>
                        <StatusPill tone={document.reviewStatus === "VERIFIED" ? "success" : document.reviewStatus === "FLAGGED" ? "danger" : "warning"}>
                          {formatEnum(document.reviewStatus)}
                        </StatusPill>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Category</p>
                          <p className="mt-2 text-sm text-slate-200">{document.category}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Extraction</p>
                          <p className="mt-2 text-sm text-slate-200">{formatEnum(document.extractionStatus)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Uploaded</p>
                          <p className="mt-2 text-sm text-slate-200">{formatDate(document.createdAt)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">File size</p>
                          <p className="mt-2 text-sm text-slate-200">{document.fileSize ? `${Math.round(document.fileSize / 1024)} KB` : "n/a"}</p>
                        </div>
                      </div>
                    </SectionCard>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="No documents uploaded yet"
                description="Upload evidence to a matter and it will appear here with extraction state, review status, and category metadata."
              />
            )}
          </PageSection>

          <div className="space-y-6">
            <PageSection title="Upload evidence">
              <SectionCard className="space-y-4">
                <p className="text-sm text-slate-300">Files uploaded through Aria are stored against real matters, linked into extraction and review flows, and surfaced here in a single evidence register.</p>
                {canEditMatter && matters.length ? (
                  <DocumentUploadForm matters={matters.map((matter) => ({ id: matter.id, label: `${matter.client.firstName} ${matter.client.lastName} - ${matter.title}` }))} />
                ) : !canEditMatter ? (
                  <p className="text-sm text-slate-400">You do not have permission to upload documents or edit matter files.</p>
                ) : (
                  <p className="text-sm text-slate-400">Create a matter before uploading documents.</p>
                )}
              </SectionCard>
            </PageSection>

            <PageSection title="Category distribution" description="Folder counts reflect real stored document metadata for the current workspace scope.">
              <div className="grid gap-3">
                {folders.map((folder) => (
                  <SectionCard key={folder} className="flex items-center justify-between gap-3 p-4">
                    <span className="text-sm text-slate-200">/{folder}</span>
                    <span className="text-sm text-slate-500">{categories.get(folder) ?? 0}</span>
                  </SectionCard>
                ))}
              </div>
            </PageSection>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
