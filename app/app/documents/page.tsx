import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { getOverview } from "@/lib/data/demo-repository";

export default function DocumentsPage() {
  const { documents } = getOverview();

  return (
    <AppShell title="Documents">
      <PageHeader title="Document Intake & Organization" subtitle="Upload evidence, classify content, and progress extraction with review-required controls." />
      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <h3 className="font-semibold">Upload queue</h3>
          <div className="mt-4 rounded-xl border border-dashed border-accent/50 bg-accent/5 p-8 text-center text-sm text-muted">Drag and drop files, or browse to upload. Pipeline steps: classify → extract → review → verify.</div>
          <div className="mt-4 flex gap-2 text-xs"><span className="rounded bg-[#111a2b] px-2 py-1">Filter: category</span><span className="rounded bg-[#111a2b] px-2 py-1">Filter: extraction status</span><span className="rounded bg-[#111a2b] px-2 py-1">Filter: review status</span></div>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm"><thead className="bg-[#101a2e] text-muted"><tr><th className="p-2 text-left">File</th><th className="p-2">Category</th><th className="p-2">Extraction</th><th className="p-2">Review</th><th className="p-2">Preview</th></tr></thead><tbody>
              {documents.slice(0, 18).map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="p-2">{d.fileName}</td>
                  <td className="p-2 text-center">{d.category}</td>
                  <td className="p-2 text-center"><StatusChip label={d.extractionStatus} /></td>
                  <td className="p-2 text-center"><StatusChip label={d.reviewStatus} /></td>
                  <td className="p-2 text-center text-muted">Placeholder</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold">Suggested Folder Structure</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">{["Identity","Travel","Employment","Education","Financial","Relationship","Health / Police","Forms","Other Evidence"].map((f)=><li key={f} className="rounded-lg border border-border p-2">/{f}</li>)}</ul>
          <p className="mt-4 text-xs text-muted">Consistent folders improve extraction quality and field mapping reliability.</p>
        </Card>
      </section>
    </AppShell>
  );
}
