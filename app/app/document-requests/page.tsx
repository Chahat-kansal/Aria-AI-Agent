import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { DocumentRequestForm } from "@/components/app/document-request-form";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export default async function DocumentRequestsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_send_client_requests")) {
    return (
      <AppShell title="Document Requests">
        <PageHeader title="Document requests unavailable" subtitle="Your company administrator controls client request access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to send or manage document requests.</p></Card>
      </AppShell>
    );
  }

  const [requests, matters] = await Promise.all([
    prisma.documentRequest.findMany({
      where: { workspaceId: context.workspace.id, ...(context.user ? { matter: scopedMatterWhere(context.user) } : {}) },
      include: { client: true, matter: true, items: { include: { checklistItem: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.matter.findMany({
      where: scopedMatterWhere(context.user),
      include: { client: true, checklistItems: { orderBy: { label: "asc" } } },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  return (
    <AppShell title="Document Requests">
      <PageHeader title="Document Requests & Reminders" subtitle="Request evidence against real matter checklists, send secure upload links, and track overdue client follow-up without fake reminder states." />
      <Card className="mb-4">
        <h3 className="font-semibold">Send document request</h3>
        <p className="mb-3 mt-1 text-sm text-muted">Choose a matter, select the real checklist items to request, and send a secure client upload link.</p>
        <DocumentRequestForm matters={matters.map((matter) => ({
          id: matter.id,
          title: matter.title,
          visaSubclass: matter.visaSubclass,
          client: { id: matter.client.id, firstName: matter.client.firstName, lastName: matter.client.lastName, email: matter.client.email },
          checklistItems: matter.checklistItems.map((item) => ({ id: item.id, label: item.label, category: item.category, status: item.status }))
        }))} />
      </Card>

      <div className="panel overflow-hidden">
        {requests.length ? (
          <table className="w-full text-sm">
            <thead className="bg-white/70 text-muted">
              <tr>
                <th className="p-3 text-left">Request</th>
                <th className="p-3 text-left">Matter</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Due</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t border-border hover:bg-white/60">
                  <td className="p-3">
                    <Link href={`/app/document-requests/${request.id}` as any} className="font-medium text-accent">{request.recipientName || request.client.firstName}</Link>
                    <p className="mt-1 text-xs text-muted">{request.items.length} checklist item{request.items.length === 1 ? "" : "s"}</p>
                  </td>
                  <td className="p-3 text-muted">{request.matter.title}</td>
                  <td className="p-3">{request.status.toLowerCase()}</td>
                  <td className="p-3 text-muted">{request.dueDate ? request.dueDate.toLocaleDateString("en-AU") : "Not set"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-muted">No document requests have been sent yet. Generate a matter checklist first, then request the missing evidence from the client.</p>
        )}
      </div>
    </AppShell>
  );
}
