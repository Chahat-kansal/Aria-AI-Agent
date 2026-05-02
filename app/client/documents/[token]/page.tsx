import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { attachDocumentToChecklistItem, markDocumentRequestViewed } from "@/lib/services/client-workflows";
import { prepareMatterDocumentUpload, persistDocumentStorageObject } from "@/lib/services/storage";
import { extractReadableText } from "@/lib/services/document-extraction";
import { uploadDocumentToMatter } from "@/lib/services/application-draft";

export default async function ClientDocumentsPage({ params, searchParams }: { params: { token: string }; searchParams?: { uploaded?: string } }) {
  const request = await markDocumentRequestViewed(params.token);
  if (!request) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
          <h1 className="mt-2 text-2xl font-semibold">Upload link unavailable</h1>
          <p className="mt-3 text-sm text-muted">This document upload link is invalid, expired, or no longer active. Ask your migration team for a fresh secure link.</p>
        </Card>
      </div>
    );
  }
  const activeRequest = request;

  async function handleUpload(formData: FormData) {
    "use server";
    const checklistItemId = String(formData.get("checklistItemId") || "");
    const file = formData.get("file");
    if (!(file instanceof File) || !checklistItemId) {
      redirect(`/client/documents/${params.token}`);
    }
    const allowedChecklistItem = activeRequest.items.find((item) => item.checklistItemId === checklistItemId);
    if (!allowedChecklistItem) {
      redirect(`/client/documents/${params.token}`);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const upload = await prepareMatterDocumentUpload({ matterId: activeRequest.matterId, fileName: file.name, bytes });
    const extractedText = await extractReadableText(bytes, file.type || "application/octet-stream");
    const document = await uploadDocumentToMatter({
      matterId: activeRequest.matterId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      storageKey: upload.storageKey,
      fileSize: upload.fileSize,
      contentHash: upload.contentHash,
      extractedText,
      uploadedByUserId: activeRequest.createdByUserId
    });
    await persistDocumentStorageObject({ documentId: document.id, upload });
    await attachDocumentToChecklistItem(checklistItemId, document.id);
    redirect(`/client/documents/${params.token}?uploaded=1`);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-3xl p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
        <h1 className="mt-2 text-2xl font-semibold">Requested documents</h1>
        <p className="mt-3 text-sm text-muted">Upload documents through this secure portal. Your migration team will review the files before using them in any application workflow.</p>
        {searchParams?.uploaded === "1" ? (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Document uploaded. Your migration team can now review it against the checklist.
          </div>
        ) : null}
        <div className="mt-6 space-y-4">
          {request.items.map((item) => (
            <Card key={item.id} className="border border-border bg-white/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.checklistItem.label}</p>
                  <p className="text-xs text-muted">{item.checklistItem.category} - {item.status.toLowerCase()}</p>
                  {item.checklistItem.description ? <p className="mt-1 text-sm text-muted">{item.checklistItem.description}</p> : null}
                </div>
                <div className="text-xs text-muted">{item.checklistItem.document ? `Uploaded: ${item.checklistItem.document.fileName}` : "Awaiting upload"}</div>
              </div>
              {!item.checklistItem.document ? (
                <form action={handleUpload} className="mt-4 flex flex-wrap items-center gap-3">
                  <input type="hidden" name="checklistItemId" value={item.checklistItemId} />
                  <input required type="file" name="file" className="max-w-full rounded-lg border border-border bg-white/80 p-2 text-sm" />
                  <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">Upload document</button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}
