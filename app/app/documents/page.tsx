import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getDocumentsData } from "@/lib/data/workspace-repository";

const folders = ["Identity", "Travel", "Education", "Financial", "Health / Insurance", "Statements / Declarations", "Forms", "Other Evidence"];

export default async function DocumentsPage() {
  const context = await getCurrentWorkspaceContext();
  const documents = context ? await getDocumentsData(context.workspace.id) : [];
  const categories = new Map<string, number>();
  for (const document of documents) categories.set(document.category, (categories.get(document.category) ?? 0) + 1);

  return (
    <AppShell title="Documents">
      <PageHeader title="Document Intake & Organization" subtitle="Upload evidence, classify content, and progress extraction with review-required controls." />
      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <h3 className="font-semibold">Workspace documents</h3>
          <div className="mt-4 rounded-xl border border-dashed border-accent/50 bg-accent/5 p-8 text-center text-sm text-muted">
            Uploads are recorded against matters from the matter draft workflow. Files shown here are live database records, not sample documents.
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            {documents.length ? (
              <table className="w-full text-sm">
                <thead className="bg-[#101a2e] text-muted"><tr><th className="p-2 text-left">File</th><th className="p-2">Matter</th><th className="p-2">Category</th><th className="p-2">Extraction</th><th className="p-2">Review</th><th className="p-2">Uploaded</th></tr></thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id} className="border-t border-border">
                      <td className="p-2">{document.fileName}</td>
                      <td className="p-2 text-center">{document.matter.client.firstName} {document.matter.client.lastName}</td>
                      <td className="p-2 text-center">{document.category}</td>
                      <td className="p-2 text-center"><StatusChip label={formatEnum(document.extractionStatus)} /></td>
                      <td className="p-2 text-center"><StatusChip label={formatEnum(document.reviewStatus)} /></td>
                      <td className="p-2 text-center text-muted">{formatDate(document.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-sm text-muted">No documents have been uploaded to this workspace yet.</p>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold">Evidence Package Structure</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {folders.map((folder) => (
              <li key={folder} className="flex items-center justify-between rounded-lg border border-border p-2">
                <span>/{folder}</span>
                <span>{categories.get(folder) ?? 0}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Folder counts reflect stored document metadata for this workspace.</p>
        </Card>
      </section>
    </AppShell>
  );
}
