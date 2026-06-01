import Link from "next/link";
import { getClientPortalByToken } from "@/lib/services/client-workflows";
import { cleanClientDescription, dueLabel, PortalCard, PortalSectionHeading, PortalShell } from "@/components/client-portal/portal-ui";
import { MobileDocumentChecklist, type MobileChecklistItem } from "@/components/client/mobile-document-checklist";
import { getMobileUploadConfigForWorkspace } from "@/lib/services/client-portal-upload";

function unavailable() {
  return (
    <PortalShell firmName="Aria Client Portal">
      <PortalCard className="mx-auto max-w-2xl">
        <PortalSectionHeading
          title="Checklist unavailable"
          description="This secure checklist link is invalid, expired, or has no active matter attached. Ask your migration team for a fresh portal link."
        />
      </PortalCard>
    </PortalShell>
  );
}

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

export default async function ClientChecklistPage({ params }: { params: { token: string } }) {
  const portal = await getClientPortalByToken(params.token);
  const matter = portal?.matter;

  if (!portal || !matter) return unavailable();

  const uploadConfig = await getMobileUploadConfigForWorkspace(portal.workspaceId);
  const missing = matter.checklistItems.filter((item) => !item.documentId && item.required).length;
  const uploaded = matter.checklistItems.filter((item) => item.documentId).length;
  const accepted = matter.checklistItems.filter((item) => item.document?.reviewStatus === "VERIFIED" || item.reviewedAt).length;

  return (
    <PortalShell firmName={portal.workspace.name} clientName={`${portal.client.firstName} ${portal.client.lastName}`} matterTitle={matter.title} subclass={matter.visaSubclass}>
      <div className="space-y-6">
        <PortalCard>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
            <PortalSectionHeading
              eyebrow="Checklist"
              title="Your document checklist"
              description="This is the client-facing list for this matter. Internal notes, staff-only review notes, and audit records are not shown."
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
        </PortalCard>

        <MobileDocumentChecklist
          items={matter.checklistItems.map(toChecklistItemView)}
          acceptedMimeTypes={uploadConfig.acceptedMimeTypes}
          acceptedFormatsLabel={uploadConfig.acceptedFormatsLabel}
          maxSizeMb={uploadConfig.maxSizeMb}
          showUploadActions={false}
        />

        <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-[1.5rem] border border-slate-200 bg-white/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur">
          <Link href={`/client/documents/${params.token}` as any} className="inline-flex h-11 items-center justify-center rounded-2xl bg-violet-700 px-4 text-sm font-semibold text-white">Upload missing documents</Link>
          <Link href={`/client/portal/${params.token}` as any} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-950">Back to portal home</Link>
        </div>
      </div>
    </PortalShell>
  );
}
