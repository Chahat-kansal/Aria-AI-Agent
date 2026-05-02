import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getClientPortalByToken } from "@/lib/services/client-workflows";

export default async function ClientPortalPage({ params }: { params: { token: string } }) {
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
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="font-medium text-white">Upload requested documents</p>
                    <p className="text-xs text-slate-500">Use your secure checklist upload link for anything still marked missing.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="font-medium text-white">Check review requests</p>
                    <p className="text-xs text-slate-500">Your migration team will send separate secure review links when confirmation is needed.</p>
                  </div>
                </div>
              </Card>
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
