import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { attachDocumentToChecklistItem, getClientPortalByToken, getDocumentRequestByToken, markDocumentRequestViewed } from "@/lib/services/client-workflows";
import { prepareMatterDocumentUpload, persistDocumentStorageObject } from "@/lib/services/storage";
import { extractReadableText } from "@/lib/services/document-extraction";
import { uploadDocumentToMatter } from "@/lib/services/application-draft";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { checkRateLimit } from "@/lib/security/rate-limit";

function prettyStatus(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function clientDocumentStatus(item: { documentId: string | null; reviewedAt: Date | null; document?: { reviewStatus: string; extractionStatus: string } | null }) {
  if (!item.documentId) return "Awaiting upload";
  if (item.document?.reviewStatus === "VERIFIED" || item.reviewedAt) return "Approved by team";
  if (item.document?.reviewStatus === "FLAGGED" || item.document?.extractionStatus === "NEEDS_REVIEW") return "Review pending";
  return "Uploaded for review";
}

function dueLabel(date?: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

async function handleClientDocumentUpload(token: string, formData: FormData) {
  "use server";
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const uploadLimit = checkRateLimit({ key: `portal.document-upload:${ip}:${token.slice(0, 12)}`, limit: 10, windowMs: 10 * 60 * 1000 });
  if (!uploadLimit.allowed) redirect(`/client/documents/${token}`);
  const checklistItemId = String(formData.get("checklistItemId") || "");
  const file = formData.get("file");
  const consentAccepted = String(formData.get("consent") || "") === "on";
  const activeRequest = await getDocumentRequestByToken(token);
  const activePortal = activeRequest ? null : await getClientPortalByToken(token);

  if (!(file instanceof File) || !checklistItemId || !consentAccepted) {
    redirect(`/client/documents/${token}`);
  }

  const requestChecklistItem = activeRequest?.items.find((item) => item.checklistItemId === checklistItemId)?.checklistItem;
  const portalChecklistItem = activePortal?.matter?.checklistItems.find((item) => item.id === checklistItemId);
  const allowedChecklistItem = requestChecklistItem ?? portalChecklistItem;
  const workspaceId = activeRequest?.workspaceId ?? activePortal?.workspaceId;
  const matterId = activeRequest?.matterId ?? activePortal?.matterId ?? undefined;
  const uploadedByUserId = activeRequest?.createdByUserId ?? activePortal?.createdByUserId ?? activePortal?.matter?.assignedToUserId;

  if (!allowedChecklistItem || !workspaceId || !matterId || !uploadedByUserId) {
    redirect(`/client/documents/${token}`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = await prepareMatterDocumentUpload({
    workspaceId,
    matterId,
    fileName: file.name,
    bytes,
    mimeType: file.type || "application/octet-stream"
  });
  const extractedText = await extractReadableText(bytes, file.type || "application/octet-stream");
  const document = await uploadDocumentToMatter({
    matterId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    storageKey: upload.storageKey,
    fileSize: upload.fileSize,
    contentHash: upload.contentHash,
    extractedText,
    uploadedByUserId
  });
  await persistDocumentStorageObject({ documentId: document.id, upload });
  await attachDocumentToChecklistItem(checklistItemId, document.id);
  redirect(`/client/documents/${token}?uploaded=1`);
}

export default async function ClientDocumentsPage({ params, searchParams }: { params: { token: string }; searchParams?: { uploaded?: string } }) {
  const request = await markDocumentRequestViewed(params.token);
  const portal = request ? null : await getClientPortalByToken(params.token);
  const matter = request?.matter ?? portal?.matter ?? null;
  const items = request
    ? request.items.map((item) => ({ ...item.checklistItem, requestItemId: item.id, requestStatus: item.status }))
    : matter?.checklistItems ?? [];

  if (!matter || !items.length) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
          <h1 className="mt-2 text-2xl font-semibold">Upload link unavailable</h1>
          <p className="mt-3 text-sm text-muted">This document upload link is invalid, expired, no longer active, or has no checklist items attached. Ask your migration team for a fresh secure link.</p>
        </Card>
      </div>
    );
  }

  const handleUpload = handleClientDocumentUpload.bind(null, params.token);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-4xl p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
        <h1 className="mt-2 text-2xl font-semibold">Requested documents</h1>
        <p className="mt-3 text-sm text-muted">Upload documents through this secure portal. Your migration team will review file quality, extraction results, and checklist status before using anything in an application workflow.</p>
        <div className="mt-4">
          <AIReviewNotice variant="client" />
        </div>
        {searchParams?.uploaded === "1" ? (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-100">
            Document uploaded. Your migration team can now review it against the checklist.
          </div>
        ) : null}
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="border border-border bg-white/70 p-4 dark:bg-white/[0.04]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted">{item.category} · {item.required ? "Required" : "Recommended"} · {prettyStatus(item.status)}</p>
                  {item.description ? <p className="mt-1 text-sm text-muted">{item.description}</p> : null}
                  {item.dueDate ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">Due {dueLabel(item.dueDate)}</p> : null}
                </div>
                <div className="rounded-full border border-border px-3 py-1 text-xs text-muted">{clientDocumentStatus(item)}</div>
              </div>
              {item.document ? (
                <div className="mt-4 rounded-xl border border-border bg-background/70 p-3 text-xs text-muted">
                  <p className="font-medium text-foreground">Uploaded: {item.document.fileName}</p>
                  <p className="mt-1">Extraction: {prettyStatus(item.document.extractionStatus)} · Review: {prettyStatus(item.document.reviewStatus)}</p>
                  {item.document.reviewStatus !== "VERIFIED" ? (
                    <p className="mt-1 text-amber-700 dark:text-amber-200">Needs agent review before any AI Working Copy or draft use.</p>
                  ) : null}
                </div>
              ) : (
                <form action={handleUpload} className="mt-4 flex flex-wrap items-center gap-3">
                  <input type="hidden" name="checklistItemId" value={item.id} />
                  <input required type="file" name="file" className="max-w-full rounded-lg border border-border bg-white/80 p-2 text-sm text-slate-950 dark:bg-slate-950/80 dark:text-white" />
                  <label className="flex min-w-full items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" name="consent" required className="mt-0.5" />
                    <span>I understand my information will be provided to my migration agent and may be processed by Aria to assist with document review and drafting. Agent review is required before use.</span>
                  </label>
                  <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">Upload document</button>
                </form>
              )}
            </Card>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {portal ? <Link href={`/client/portal/${params.token}` as any} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Back to portal home</Link> : null}
          <Link href={`/client/book/${params.token}` as any} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Request appointment</Link>
        </div>
      </Card>
    </div>
  );
}
