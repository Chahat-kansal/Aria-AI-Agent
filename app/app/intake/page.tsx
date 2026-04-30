import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { IntakeRequestForm } from "@/components/app/intake-request-form";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export default async function IntakePage() {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_send_client_requests")) {
    return (
      <AppShell title="Client Intake">
        <PageHeader title="Client intake unavailable" subtitle="Your company administrator controls client intake request access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to send or manage intake requests.</p></Card>
      </AppShell>
    );
  }

  const [requests, matters] = await Promise.all([
    prisma.clientIntakeRequest.findMany({
      where: { workspaceId: context.workspace.id, ...(context.user ? { matter: scopedMatterWhere(context.user) } : {}) },
      include: { client: true, matter: true, createdByUser: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.matter.findMany({
      where: scopedMatterWhere(context.user),
      include: { client: true },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  return (
    <AppShell title="Client Intake">
      <PageHeader title="Client Intake Portal" subtitle="Create real intake requests, capture client questionnaires securely, and move matters from intake to evidence collection without mock workflows." />

      <Card className="mb-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Secure intake</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Send intake request</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">Create a secure intake link for a client. If email is not configured, Aria will still give you the live link to share manually.</p>
          </div>
          <StatusPill tone="info">Client portal</StatusPill>
        </div>
        <IntakeRequestForm matters={matters} />
      </Card>

      <div className="aria-table-wrap">
        {requests.length ? (
          <table className="w-full text-sm">
            <thead className="aria-table-head">
              <tr>
                <th className="aria-table-th">Request</th>
                <th className="aria-table-th">Client / matter</th>
                <th className="aria-table-th">Status</th>
                <th className="aria-table-th">Sent</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="aria-table-row">
                  <td className="aria-table-td">
                    <Link href={`/app/intake/${request.id}` as any} className="font-medium text-cyan-300 transition hover:text-white">{request.title}</Link>
                    <p className="mt-1 text-xs text-slate-400">Created by {request.createdByUser.name}</p>
                  </td>
                  <td className="aria-table-td text-slate-300">
                    {request.client ? `${request.client.firstName} ${request.client.lastName}` : request.recipientName || "Unlinked client"}
                    {request.matter ? <p className="text-xs">{request.matter.title}</p> : null}
                  </td>
                  <td className="aria-table-td"><StatusPill>{request.status.toLowerCase()}</StatusPill></td>
                  <td className="aria-table-td text-slate-300">{request.createdAt.toLocaleDateString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No intake requests yet" description="Create one above to launch the secure client intake portal." />
        )}
      </div>
    </AppShell>
  );
}
