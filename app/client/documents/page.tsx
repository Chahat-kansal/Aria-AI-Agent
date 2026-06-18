import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientPortalSession } from "@/lib/services/client-portal-session";
import { cleanClientDescription, dueLabel, PortalCard, PortalSectionHeading, PortalShell } from "@/components/client-portal/portal-ui";
import { MobileDocumentChecklist, type MobileChecklistItem } from "@/components/client/mobile-document-checklist";
import { getMobileUploadConfigForWorkspace } from "@/lib/services/client-portal-upload";

function toChecklistItemView(item: any): MobileChecklistItem {
  const reviewAccepted = item.reviewedAt || item.document?.reviewStatus === "VERIFIED";
  const needsReupload = item.document?.reviewStatus === "FLAGGED";
  const waitingReview = Boolean(item.documentId) && !reviewAccepted && !needsReupload;
  return {
    id: item.id,
    label: item.label,
    category: item.category,
    description: cleanClientDescription(item.description),
    required: Boolean(item.required),
    dueLabel: dueLabel(item.dueDate),
    statusLabel: reviewAccepted
      ? "Accepted"
      : needsReupload
        ? "Re-upload requested"
        : waitingReview
          ? "Uploaded - waiting for team review"
          : item.required
            ? "Missing"
            : "Optional",
    statusTone: reviewAccepted
      ? "success"
      : needsReupload
        ? "danger"
        : waitingReview
          ? "info"
          : item.required
            ? "warning"
            : "neutral",
    documentId: item.documentId,
    fileName: item.document?.fileName ?? null,
    uploadTimeLabel: item.document?.createdAt ? item.document.createdAt.toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }) : null,
    teamNote: needsReupload
      ? "Please upload a clearer copy. Your migration team will review the replacement before use."
      : item.documentId
        ? "Your migration team will review this before use."
        : null,
    needsReupload
  };
}

export default async function ClientDocumentsSessionPage() {
  const portal = await getClientPortalSession();
  if (!portal?.matter) redirect("/client/login");

  const items = portal.matter.checklistItems;
  const uploadConfig = await getMobileUploadConfigForWorkspace(portal.workspaceId);
  const missing = items.filter((item) => !item.documentId && item.required).length;
  const uploaded = items.filter((item) => item.documentId).length;
  const accepted = items.filter((item) => item.reviewedAt || item.document?.reviewStatus === "VERIFIED").length;

  return (
    <PortalShell firmName={portal.workspace.name} clientName={`${portal.client.firstName} ${portal.client.lastName}`} matterTitle={portal.matter.title} subclass={portal.matter.visaSubclass}>
      <div className="space-y-6">
        <PortalCard>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
            <PortalSectionHeading
              eyebrow="Documents"
              title="Upload your documents"
              description="This mobile upload page is designed for clear scans and phone photos. Your migration team will review every upload before use."
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
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">Photo guidance</p>
              <ul className="mt-3 space-y-2 leading-6">
                <li>Take a clear photo or upload a scan.</li>
                <li>Make sure all corners are visible.</li>
                <li>Make sure the text is sharp and readable.</li>
                <li>Avoid glare or shadows.</li>
                <li>Upload one document at a time.</li>
                <li>Do not crop out any part of the document.</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">Upload rules</p>
              <p className="mt-3">Accepted formats: {uploadConfig.acceptedFormatsLabel}</p>
              <p className="mt-2">Max size: {uploadConfig.maxSizeMb} MB</p>
              <p className="mt-3">Your migration team will review the uploaded file.</p>
            </div>
          </div>
        </PortalCard>

        <MobileDocumentChecklist
          items={items.map(toChecklistItemView)}
          acceptedMimeTypes={uploadConfig.acceptedMimeTypes}
          acceptedFormatsLabel={uploadConfig.acceptedFormatsLabel}
          maxSizeMb={uploadConfig.maxSizeMb}
          showUploadActions
        />

        <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-[1.5rem] border border-slate-200 bg-white/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur">
          <Link href={"/client/portal" as any} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-950">Back to portal home</Link>
          <Link href={"/client/checklist" as any} className="inline-flex h-11 items-center justify-center rounded-2xl bg-violet-700 px-4 text-sm font-semibold text-white">View checklist</Link>
          <Link href={"/client/book" as any} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950">Request appointment</Link>
        </div>
      </div>
    </PortalShell>
  );
}
