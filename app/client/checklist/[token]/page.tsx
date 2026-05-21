import Link from "next/link";
import { getClientPortalByToken } from "@/lib/services/client-workflows";
import { documentStatus, dueLabel, PortalCard, PortalSectionHeading, PortalShell, PortalStatusBadge } from "@/components/client-portal/portal-ui";

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

export default async function ClientChecklistPage({ params }: { params: { token: string } }) {
  const portal = await getClientPortalByToken(params.token);
  const matter = portal?.matter;

  if (!portal || !matter) return unavailable();

  const grouped = matter.checklistItems.reduce<Record<string, typeof matter.checklistItems>>((acc, item) => {
    acc[item.category] = acc[item.category] ?? [];
    acc[item.category].push(item);
    return acc;
  }, {});
  const missing = matter.checklistItems.filter((item) => !item.documentId && item.required).length;
  const uploaded = matter.checklistItems.filter((item) => item.documentId).length;
  const accepted = matter.checklistItems.filter((item) => item.document?.reviewStatus === "VERIFIED" || item.reviewedAt).length;

  return (
    <PortalShell firmName={portal.workspace.name} clientName={`${portal.client.firstName} ${portal.client.lastName}`} matterTitle={matter.title} subclass={matter.visaSubclass}>
      <div className="space-y-6">
        <PortalCard>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <PortalSectionHeading
              eyebrow="Checklist"
              title="Your document checklist"
              description="This is the client-facing list for this matter. Internal notes and audit records are not shown."
            />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-2xl font-semibold text-white">{missing}</p>
                <p className="mt-1 text-xs text-slate-400">Still needed</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-2xl font-semibold text-white">{uploaded}</p>
                <p className="mt-1 text-xs text-slate-400">Uploaded</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-2xl font-semibold text-white">{accepted}</p>
                <p className="mt-1 text-xs text-slate-400">Accepted</p>
              </div>
            </div>
          </div>
        </PortalCard>

        <div className="space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <PortalCard key={category}>
              <PortalSectionHeading title={category} />
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {items.map((item) => {
                  const status = documentStatus(item);
                  return (
                    <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{item.label}</p>
                          <p className="mt-1 text-xs text-slate-400">{item.required ? "Required" : "Recommended"}{item.dueDate ? ` · Due ${dueLabel(item.dueDate)}` : ""}</p>
                          {item.description ? <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p> : null}
                          {item.document ? <p className="mt-2 text-xs text-slate-500">Uploaded: {item.document.fileName}</p> : null}
                        </div>
                        <PortalStatusBadge tone={status.tone}>{status.label}</PortalStatusBadge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </PortalCard>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/client/documents/${params.token}` as any} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950">Upload missing documents</Link>
          <Link href={`/client/portal/${params.token}` as any} className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white">Back to portal home</Link>
        </div>
      </div>
    </PortalShell>
  );
}
