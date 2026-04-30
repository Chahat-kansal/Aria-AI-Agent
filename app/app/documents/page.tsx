import { AppShell } from "@/components/app/app-shell";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { DocumentUploadForm } from "@/components/app/document-upload-form";
import { EmptyState } from "@/components/ui/empty-state";
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

  return (
    <AppShell title="Documents">
      <div className="space-y-6">
        <PageHeader
          title="Document Intake & Organization"
          description="Upload evidence, classify content, and progress extraction with review-required controls."
        />

        <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Workspace documents</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Uploads are recorded against live matters from the matter workflow. No placeholder files are shown here.
              </p>
            </div>

            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
              Files uploaded through Aria are stored against matters, linked into extraction and review flows, and surfaced here in a single evidence register.
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45 backdrop-blur-xl">
              {documents.length ? (
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03]">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">File</th>
                      <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">Matter</th>
                      <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">Category</th>
                      <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">Size</th>
                      <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">Extraction</th>
                      <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">Review</th>
                      <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <tr key={document.id} className="border-t border-white/5 transition hover:bg-white/[0.04]">
                        <td className="px-4 py-3 text-sm text-slate-300">
                          <Link href={`/app/documents/${document.id}` as any} className="font-medium text-cyan-300 hover:text-cyan-200">
                            {document.fileName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-300">{document.matter.client.firstName} {document.matter.client.lastName}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-300">{document.category}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-400">{document.fileSize ? `${Math.round(document.fileSize / 1024)} KB` : "n/a"}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-300"><StatusChip label={formatEnum(document.extractionStatus)} /></td>
                        <td className="px-4 py-3 text-center text-sm text-slate-300"><StatusChip label={formatEnum(document.reviewStatus)} /></td>
                        <td className="px-4 py-3 text-center text-sm text-slate-400">{formatDate(document.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6">
                  <EmptyState
                    title="No documents uploaded yet"
                    description="Upload evidence to a matter and it will appear here with extraction state, review status, and category metadata."
                  />
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Evidence package structure</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Keep uploads organized into matter-ready categories so the draft, checklist, and client workflows stay aligned.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-3 text-sm font-medium text-white">Upload evidence to a matter</p>
              {canEditMatter && matters.length ? (
                <DocumentUploadForm matters={matters.map((matter) => ({ id: matter.id, label: `${matter.client.firstName} ${matter.client.lastName} · ${matter.title}` }))} />
              ) : !canEditMatter ? (
                <p className="text-sm text-slate-400">You do not have permission to upload documents or edit matter files.</p>
              ) : (
                <p className="text-sm text-slate-400">Create a matter before uploading documents.</p>
              )}
            </div>

            <ul className="space-y-2 text-sm text-slate-300">
              {folders.map((folder) => (
                <li key={folder} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span>/{folder}</span>
                  <span className="text-slate-400">{categories.get(folder) ?? 0}</span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-slate-400">Folder counts reflect real stored document metadata for the current workspace scope.</p>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
