import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { DocumentRequestForm } from "@/components/app/document-request-form";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
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
      <Card className="mb-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Evidence collection</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Send document request</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">Choose a matter, select the real checklist items to request, and send a secure client upload link.</p>
          </div>
          <StatusPill tone="warning">Follow-up ready</StatusPill>
        </div>
        <DocumentRequestForm matters={matters.map((matter) => ({
          id: matter.id,
          title: matter.title,
          visaSubclass: matter.visaSubclass,
          client: { id: matter.client.id, firstName: matter.client.firstName, lastName: matter.client.lastName, email: matter.client.email },
          checklistItems: matter.checklistItems.map((item) => ({ id: item.id, label: item.label, category: item.category, status: item.status }))
        }))} />
      </Card>

      <div className="aria-table-wrap">
        {requests.length ? (
          <table className="w-full text-sm">
            <thead className="aria-table-head">
              <tr>
                <th className="aria-table-th">Request</th>
                <th className="aria-table-th">Matter</th>
                <th className="aria-table-th">Status</th>
                <th className="aria-table-th">Due</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="aria-table-row">
                  <td className="aria-table-td">
                    <Link href={`/app/document-requests/${request.id}` as any} className="font-medium text-cyan-300 transition hover:text-white">{request.recipientName || request.client.firstName}</Link>
                    <p className="mt-1 text-xs text-slate-400">{request.items.length} checklist item{request.items.length === 1 ? "" : "s"}</p>
                  </td>
                  <td className="aria-table-td text-slate-300">{request.matter.title}</td>
                  <td className="aria-table-td"><StatusPill>{request.status.toLowerCase()}</StatusPill></td>
                  <td className="aria-table-td text-slate-300">{request.dueDate ? request.dueDate.toLocaleDateString("en-AU") : "Not set"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No document requests yet" description="Generate a matter checklist first, then request the missing evidence from the client." />
        )}
      </div>
    </AppShell>
  );
}
