import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getClientPortalByToken } from "@/lib/services/client-workflows";

export default async function ClientPortalPage({ params }: { params: { token: string } }) {
  const portal = await getClientPortalByToken(params.token);
  if (!portal) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
          <h1 className="mt-2 text-2xl font-semibold">Portal link unavailable</h1>
          <p className="mt-3 text-sm text-muted">This client portal link is invalid, expired, or has been replaced. Ask your migration team to send a fresh secure link.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-4xl p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
        <h1 className="mt-2 text-2xl font-semibold">{portal.client.firstName} {portal.client.lastName}</h1>
        <p className="mt-3 text-sm text-muted">This secure portal shows your active matter timeline, requested documents, review requests, and appointment context. All outputs remain subject to registered migration agent review.</p>

        {portal.matter ? (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-white/70 p-4 text-sm">
                <p className="text-muted">Matter</p>
                <p className="mt-1 font-medium">{portal.matter.title}</p>
                <p className="text-xs text-muted">Subclass {portal.matter.visaSubclass} - {portal.matter.stage.toLowerCase()}</p>
              </div>
              <div className="rounded-lg border border-border bg-white/70 p-4 text-sm">
                <p className="text-muted">Current status</p>
                <p className="mt-1 font-medium">{portal.matter.status.toLowerCase()}</p>
                <p className="text-xs text-muted">Readiness {portal.matter.readinessScore}%</p>
              </div>
              <div className="rounded-lg border border-border bg-white/70 p-4 text-sm">
                <p className="text-muted">Documents</p>
                <p className="mt-1 font-medium">{portal.matter.documents.length} uploaded</p>
                <p className="text-xs text-muted">{portal.matter.checklistItems.filter((item) => !item.documentId).length} checklist item(s) still missing</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <h3 className="font-semibold">Case timeline</h3>
                <div className="mt-3 space-y-3">
                  {portal.matter.timelineEvents.length ? portal.matter.timelineEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-border bg-white/55 p-3 text-sm">
                      <p className="font-medium">{event.title}</p>
                      <p className="mt-1 text-xs text-muted">{event.createdAt.toLocaleString("en-AU")}</p>
                      {event.description ? <p className="mt-2 text-muted">{event.description}</p> : null}
                    </div>
                  )) : <p className="text-sm text-muted">No timeline events are recorded yet.</p>}
                </div>
              </Card>
              <Card>
                <h3 className="font-semibold">Checklist & review</h3>
                <div className="mt-3 space-y-2 text-sm text-muted">
                  {portal.matter.checklistItems.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-white/55 p-3">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs">{item.status.toLowerCase()} {item.document ? `- ${item.document.fileName}` : ""}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/client/checklist/${params.token}` as any} className="rounded-lg border border-border bg-white/70 px-4 py-2 text-sm text-accent">Open checklist uploads</Link>
                  {portal.matter.reviewRequests[0] ? <span className="rounded-lg border border-border bg-white/70 px-4 py-2 text-sm text-muted">Latest review status: {portal.matter.reviewRequests[0].status.toLowerCase()}</span> : null}
                </div>
              </Card>
            </div>

            <Card className="mt-6">
              <h3 className="font-semibold">Upcoming tasks & actions</h3>
              <div className="mt-3 space-y-2 text-sm text-muted">
                {portal.matter.tasks.length ? portal.matter.tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-border bg-white/55 p-3">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs">{task.dueDate.toLocaleDateString("en-AU")}</p>
                  </div>
                )) : <p>No pending tasks are visible in this portal yet.</p>}
              </div>
            </Card>
          </>
        ) : (
          <div className="mt-6 rounded-lg border border-border bg-white/70 p-4 text-sm text-muted">No matter is linked to this portal yet.</div>
        )}
      </Card>
    </div>
  );
}
