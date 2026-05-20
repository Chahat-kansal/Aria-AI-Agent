import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getClientPortalByToken } from "@/lib/services/client-workflows";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";

function prettyStatus(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function checklistStatus(item: { documentId: string | null; reviewedAt: Date | null; document?: { reviewStatus: string; extractionStatus: string } | null }) {
  if (!item.documentId) return "Missing";
  if (item.document?.reviewStatus === "VERIFIED" || item.reviewedAt) return "Approved";
  if (item.document?.reviewStatus === "FLAGGED" || item.document?.extractionStatus === "NEEDS_REVIEW") return "Review pending";
  return "Uploaded";
}

function dueLabel(date?: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ClientChecklistPage({ params }: { params: { token: string } }) {
  const portal = await getClientPortalByToken(params.token);
  const matter = portal?.matter;

  if (!portal || !matter) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
          <h1 className="mt-2 text-2xl font-semibold">Checklist unavailable</h1>
          <p className="mt-3 text-sm text-muted">This secure checklist link is invalid, expired, or has no active matter attached. Ask your migration team for a fresh portal link.</p>
        </Card>
      </div>
    );
  }

  const grouped = matter.checklistItems.reduce<Record<string, typeof matter.checklistItems>>((acc, item) => {
    acc[item.category] = acc[item.category] ?? [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-5xl p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
        <h1 className="mt-2 text-2xl font-semibold">Document checklist</h1>
        <p className="mt-3 text-sm text-muted">This checklist is scoped to {matter.title}. Uploads and extracted information remain subject to registered migration agent review.</p>
        <div className="mt-4">
          <AIReviewNotice variant="client" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-4 text-sm">
            <p className="text-muted">Missing</p>
            <p className="mt-1 text-2xl font-semibold">{matter.checklistItems.filter((item) => !item.documentId).length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-4 text-sm">
            <p className="text-muted">Uploaded for review</p>
            <p className="mt-1 text-2xl font-semibold">{matter.checklistItems.filter((item) => item.documentId && item.document?.reviewStatus !== "VERIFIED").length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-4 text-sm">
            <p className="text-muted">Approved</p>
            <p className="mt-1 text-2xl font-semibold">{matter.checklistItems.filter((item) => item.document?.reviewStatus === "VERIFIED" || item.reviewedAt).length}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category} className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-white/[0.04]">
              <h2 className="text-sm font-semibold">{category}</h2>
              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-background/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="mt-1 text-xs text-muted">{item.required ? "Required" : "Recommended"} · {prettyStatus(item.status)}</p>
                        {item.description ? <p className="mt-1 text-sm text-muted">{item.description}</p> : null}
                      </div>
                      <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">{checklistStatus(item)}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {item.document ? `Uploaded: ${item.document.fileName}` : item.dueDate ? `Due ${dueLabel(item.dueDate)}` : "No file uploaded yet"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/client/documents/${params.token}` as any} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">Upload missing documents</Link>
          <Link href={`/client/portal/${params.token}` as any} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Back to portal home</Link>
        </div>
      </Card>
    </div>
  );
}
