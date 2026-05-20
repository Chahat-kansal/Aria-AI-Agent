import Link from "next/link";
import { headers } from "next/headers";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getClientPortalByToken } from "@/lib/services/client-workflows";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { checkRateLimit } from "@/lib/security/rate-limit";

export default async function ClientPortalPage({ params }: { params: { token: string } }) {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const portalLimit = checkRateLimit({ key: `portal.open:${ip}:${params.token.slice(0, 12)}`, limit: 40, windowMs: 60_000 });
  if (!portalLimit.allowed) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-4 py-10 text-slate-50">
        <div className="mx-auto max-w-2xl">
          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Aria Client Portal</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Please wait and try again</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Too many portal attempts were made from this connection. Ask your migration team for help if this continues.</p>
          </Card>
        </div>
      </div>
    );
  }
  const portal = await getClientPortalByToken(params.token);
  if (!portal) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-4 py-10 text-slate-50">
        <div className="mx-auto max-w-2xl">
          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Aria Client Portal</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Portal link unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">This client portal link is invalid, expired, or has been replaced. Ask your migration team to send a fresh secure link.</p>
          </Card>
        </div>
      </div>
    );
  }

  const settings = await getWorkspaceOperationalSettingsView(portal.workspaceId);

  const visibleTimelineEvents = (portal.matter?.timelineEvents ?? []).filter((event) =>
    [
      "matter.created",
      "intake.sent",
      "intake.viewed",
      "intake.submitted",
      "documents.requested",
      "document.uploaded",
      "documents.reminder_sent",
      "appointment.booked",
      "generated_document.created",
      "client.review.sent",
      "client.review.returned",
      "client.review.confirmed"
    ].includes(event.eventType)
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Aria Client Portal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{portal.client.firstName} {portal.client.lastName}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">This secure portal shows your active matter timeline, requested documents, review requests, and appointment context. All outputs remain subject to registered migration agent review.</p>
          <p className="mt-2 text-xs text-slate-500">{settings.clientPortalHelpText}</p>
          <AIReviewNotice variant="client" className="mt-4" />

          {portal.matter ? (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-sm">
                  <p className="text-slate-400">Matter</p>
                  <p className="mt-1 font-medium text-white">{portal.matter.title}</p>
                  <p className="text-xs text-slate-500">Subclass {portal.matter.visaSubclass} · {portal.matter.stage.toLowerCase()}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-sm">
                  <p className="text-slate-400">Current status</p>
                  <p className="mt-1 font-medium text-white">{portal.matter.status.toLowerCase()}</p>
                  <p className="text-xs text-slate-500">Readiness {portal.matter.readinessScore}%</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-sm">
                  <p className="text-slate-400">Documents</p>
                  <p className="mt-1 font-medium text-white">{portal.matter.documents.length} uploaded</p>
                  <p className="text-xs text-slate-500">{portal.matter.checklistItems.filter((item) => !item.documentId).length} checklist item(s) still missing</p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <h3 className="text-sm font-semibold text-slate-100">Case timeline</h3>
                  <div className="mt-4 space-y-3">
                    {visibleTimelineEvents.length ? visibleTimelineEvents.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                        <p className="font-medium text-white">{event.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{event.createdAt.toLocaleString("en-AU")}</p>
                        {event.description ? <p className="mt-2 text-slate-300">{event.description}</p> : null}
                      </div>
                    )) : <p className="text-sm text-slate-400">No client-visible timeline events are recorded yet.</p>}
                  </div>
                </Card>
                <Card>
                  <h3 className="text-sm font-semibold text-slate-100">Checklist & review</h3>
                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    {portal.matter.checklistItems.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="font-medium text-white">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.status.toLowerCase()} {item.document ? `· ${item.document.fileName}` : ""}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/client/checklist/${params.token}` as any} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95">Open checklist uploads</Link>
                    {portal.matter.reviewRequests[0] ? <span className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-300">Latest review status: {portal.matter.reviewRequests[0].status.toLowerCase()}</span> : null}
                  </div>
                </Card>
              </div>

              <Card className="mt-6">
                <h3 className="text-sm font-semibold text-slate-100">Next secure actions</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-slate-300">
                  <Link href={`/client/documents/${params.token}` as any} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
                    <p className="font-medium text-white">Upload documents</p>
                    <p className="mt-1 text-xs text-slate-500">Securely upload requested documents for this matter.</p>
                  </Link>
                  <Link href={`/client/intake/${params.token}` as any} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
                    <p className="font-medium text-white">Complete intake</p>
                    <p className="mt-1 text-xs text-slate-500">Update your details for agent review before use.</p>
                  </Link>
                  <Link href={`/client/checklist/${params.token}` as any} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
                    <p className="font-medium text-white">View checklist</p>
                    <p className="mt-1 text-xs text-slate-500">See outstanding evidence and upload requirements.</p>
                  </Link>
                  <Link href={`/client/book/${params.token}` as any} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
                    <p className="font-medium text-white">Book appointment</p>
                    <p className="mt-1 text-xs text-slate-500">Request a consultation or use configured appointment availability.</p>
                  </Link>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 md:col-span-2">
                    <p className="font-medium text-white">Review requests</p>
                    <p className="mt-1 text-xs text-slate-500">Your migration team will send separate secure review links when confirmation is needed.</p>
                  </div>
                </div>
              </Card>

              {portal.matter.officialFormDrafts.length ? (
                <Card className="mt-6">
                  <h3 className="text-sm font-semibold text-slate-100">Approved forms</h3>
                  <div className="mt-4 space-y-3">
                    {portal.matter.officialFormDrafts.map((draft) => (
                      <a
                        key={draft.id}
                        href={`/api/forms/drafts/${draft.id}/download?portalToken=${params.token}`}
                        className="block rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]"
                      >
                        <p className="font-medium text-white">{draft.generatedFileName ?? "Approved PDF draft"}</p>
                        <p className="mt-1 text-xs text-slate-500">Approved by agent for client record/review. This system does not lodge applications.</p>
                      </a>
                    ))}
                  </div>
                </Card>
              ) : null}
            </>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="No matter linked yet"
                description="Your migration team has not linked an active matter to this portal yet. Once it is linked, you will see checklist items, document requests, and review milestones here."
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
