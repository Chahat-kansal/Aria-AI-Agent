import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { DocumentRequestReminderButton } from "@/components/app/document-request-reminder-button";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export default async function DocumentRequestDetailPage({ params }: { params: { requestId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_send_client_requests")) {
    return (
      <AppShell title="Document Requests">
        <PageHeader title="Document requests unavailable" subtitle="Your company administrator controls client request access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to view document requests.</p></Card>
      </AppShell>
    );
  }

  const request = await prisma.documentRequest.findFirst({
    where: { id: params.requestId, workspaceId: context.workspace.id, ...(context.user ? { matter: scopedMatterWhere(context.user) } : {}) },
    include: {
      client: true,
      matter: true,
      items: { include: { checklistItem: { include: { document: true } } }, orderBy: { createdAt: "asc" } }
    }
  });
  if (!request) notFound();

  return (
    <AppShell title="Document Requests">
      <PageHeader title={`Document request for ${request.client.firstName} ${request.client.lastName}`} subtitle="Track requested checklist items, due dates, reminder status, and secure client upload follow-up." />
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold tracking-tight text-white">Request details</h3>
            <StatusPill>{request.status.toLowerCase()}</StatusPill>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
            <div className="aria-note">Status<br /><span className="text-white">{request.status.toLowerCase()}</span></div>
            <div className="aria-note">Due date<br /><span className="text-white">{request.dueDate ? request.dueDate.toLocaleDateString("en-AU") : "Not set"}</span></div>
            <div className="aria-note">Viewed<br /><span className="text-white">{request.viewedAt ? request.viewedAt.toLocaleString("en-AU") : "Not yet"}</span></div>
            <div className="aria-note">Reminder sent<br /><span className="text-white">{request.reminderSentAt ? request.reminderSentAt.toLocaleString("en-AU") : "Not yet"}</span></div>
          </div>
          {request.message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">{request.message}</p> : null}
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Client follow-up</h3>
          <p className="mt-2 text-sm text-slate-300">Send a fresh reminder and secure upload link. If email is not configured, the new link is still returned here so your team can share it manually.</p>
          <div className="mt-4">
            <DocumentRequestReminderButton requestId={request.id} />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="text-xl font-semibold tracking-tight text-white">Requested checklist items</h3>
        <div className="mt-3 space-y-2">
          {request.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{item.checklistItem.label}</p>
                  <p className="text-xs text-slate-400">{item.checklistItem.category} - {item.status.toLowerCase()}</p>
                </div>
                <p className="text-xs text-slate-400">{item.checklistItem.document ? `Uploaded: ${item.checklistItem.document.fileName}` : "Waiting for upload"}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
