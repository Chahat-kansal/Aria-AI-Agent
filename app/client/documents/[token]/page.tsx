import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { attachDocumentToChecklistItem, getClientPortalByToken, getDocumentRequestByToken, markDocumentRequestViewed } from "@/lib/services/client-workflows";
import { prepareMatterDocumentUpload, persistDocumentStorageObject } from "@/lib/services/storage";
import { extractReadableText } from "@/lib/services/document-extraction";
import { uploadDocumentToMatter } from "@/lib/services/application-draft";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { cleanClientDescription, documentStatus, dueLabel, PortalCard, PortalSectionHeading, PortalShell, PortalStatusBadge } from "@/components/client-portal/portal-ui";
import { PortalUploadForm } from "@/components/client-portal/portal-upload-form";

function clientDocumentStatus(item: { documentId: string | null; reviewedAt: Date | null; status: string; required: boolean; document?: { reviewStatus: string; extractionStatus: string } | null }) {
  return documentStatus(item);
}

async function handleClientDocumentUpload(token: string, formData: FormData) {
  "use server";
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const uploadLimit = checkRateLimit({ key: `portal.document-upload:${ip}:${token.slice(0, 12)}`, limit: 10, windowMs: 10 * 60 * 1000 });
  if (!uploadLimit.allowed) redirect(`/client/documents/${token}?error=rate-limited`);
  const checklistItemId = String(formData.get("checklistItemId") || "");
  const file = formData.get("file");
  const consentAccepted = String(formData.get("consent") || "") === "on";
  const activeRequest = await getDocumentRequestByToken(token);
  const activePortal = activeRequest ? null : await getClientPortalByToken(token);

  if (!(file instanceof File) || !checklistItemId || !consentAccepted) {
    redirect(`/client/documents/${token}?error=missing-file`);
  }

  const requestChecklistItem = activeRequest?.items.find((item) => item.checklistItemId === checklistItemId)?.checklistItem;
  const portalChecklistItem = activePortal?.matter?.checklistItems.find((item) => item.id === checklistItemId);
  const allowedChecklistItem = requestChecklistItem ?? portalChecklistItem;
  const workspaceId = activeRequest?.workspaceId ?? activePortal?.workspaceId;
  const matterId = activeRequest?.matterId ?? activePortal?.matterId ?? undefined;
  const uploadedByUserId = activeRequest?.createdByUserId ?? activePortal?.createdByUserId ?? activePortal?.matter?.assignedToUserId;

  if (!allowedChecklistItem || !workspaceId || !matterId || !uploadedByUserId) {
    redirect(`/client/documents/${token}?error=invalid-request`);
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

function unavailable(title: string, description: string) {
  return (
    <PortalShell firmName="Aria Client Portal">
      <PortalCard className="mx-auto max-w-2xl">
        <PortalSectionHeading title={title} description={description} />
      </PortalCard>
    </PortalShell>
  );
}

export default async function ClientDocumentsPage({ params, searchParams }: { params: { token: string }; searchParams?: { uploaded?: string; error?: string } }) {
  const request = await markDocumentRequestViewed(params.token);
  const portal = request ? null : await getClientPortalByToken(params.token);
  const matter = request?.matter ?? portal?.matter ?? null;
  const client = request?.client ?? portal?.client ?? null;
  const items = request
    ? request.items.map((item) => ({ ...item.checklistItem, requestItemId: item.id, requestStatus: item.status }))
    : matter?.checklistItems ?? [];

  if (!matter || !items.length) {
    return unavailable("Upload link unavailable", "This document upload link is invalid, expired, no longer active, or has no checklist items attached. Ask your migration team for a fresh secure link.");
  }

  const handleUpload = handleClientDocumentUpload.bind(null, params.token);
  const missing = items.filter((item) => !item.documentId && item.required).length;
  const uploaded = items.filter((item) => item.documentId).length;
  const accepted = items.filter((item) => item.reviewedAt || item.document?.reviewStatus === "VERIFIED").length;

  return (
    <PortalShell
      firmName={portal?.workspace.name || "Your migration team"}
      clientName={client ? `${client.firstName} ${client.lastName}` : "Client documents"}
      matterTitle={matter.title}
      subclass={matter.visaSubclass}
    >
      <div className="space-y-6">
        <PortalCard>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <PortalSectionHeading
              eyebrow="Documents"
              title="Upload your documents"
              description="Use this secure page for scans and photos. Your migration team will check quality before using anything."
            />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-2xl font-semibold text-slate-950">{missing}</p>
                <p className="mt-1 text-xs text-slate-600">Still needed</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-2xl font-semibold text-slate-950">{uploaded}</p>
                <p className="mt-1 text-xs text-slate-600">Uploaded</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-2xl font-semibold text-slate-950">{accepted}</p>
                <p className="mt-1 text-xs text-slate-600">Accepted</p>
              </div>
            </div>
          </div>
          {searchParams?.uploaded === "1" ? (
            <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Document uploaded. Your migration team can now review it.
            </p>
          ) : null}
          {searchParams?.error ? (
            <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              Upload could not be completed. Please choose a supported file and try again.
            </p>
          ) : null}
        </PortalCard>

        <div className="grid gap-5 lg:grid-cols-2">
          {items.map((item) => {
            const status = clientDocumentStatus(item);
            const needsReupload = status.label === "Needs clearer copy" || status.label === "Re-upload requested";
            return (
              <PortalCard key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.category} · {item.required ? "Required" : "Recommended"}{item.dueDate ? ` · Due ${dueLabel(item.dueDate)}` : ""}</p>
                    {cleanClientDescription(item.description) ? <p className="mt-3 text-sm leading-6 text-slate-600">{cleanClientDescription(item.description)}</p> : null}
                  </div>
                  <PortalStatusBadge tone={status.tone}>{status.label}</PortalStatusBadge>
                </div>

                {item.document ? (
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-slate-950">Uploaded file</p>
                    <p className="mt-1 break-words">{item.document.fileName}</p>
                    <p className="mt-2 text-xs text-slate-500">Review: {status.label}. Quality: {item.document.extractionStatus === "NEEDS_REVIEW" ? "Re-upload recommended" : "Review by migration team"}.</p>
                    {needsReupload ? <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Please upload a clearer scan or photo. Make sure all corners are visible and there is no glare.</p> : null}
                  </div>
                ) : null}

                {!item.documentId || needsReupload ? (
                  <PortalUploadForm checklistItemId={item.id} uploadAction={handleUpload} buttonLabel={item.documentId ? "Re-upload document" : "Upload document"} />
                ) : (
                  <p className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    No action needed right now. Your migration team will contact you if they need a clearer copy.
                  </p>
                )}
              </PortalCard>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          {portal ? <Link href={`/client/portal/${params.token}` as any} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-950">Back to portal home</Link> : null}
          <Link href={`/client/book/${params.token}` as any} className="rounded-2xl bg-violet-700 px-4 py-2 text-sm font-semibold text-[#fff]">Request appointment</Link>
        </div>
      </div>
    </PortalShell>
  );
}

