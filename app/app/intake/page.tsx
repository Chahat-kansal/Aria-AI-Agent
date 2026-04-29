import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { IntakeRequestForm } from "@/components/app/intake-request-form";
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

      <Card className="mb-4">
        <h3 className="font-semibold">Send intake request</h3>
        <p className="mb-3 mt-1 text-sm text-muted">Create a secure intake link for a client. If email is not configured, Aria will still give you the live link to share manually.</p>
        <IntakeRequestForm matters={matters} />
      </Card>

      <div className="panel overflow-hidden">
        {requests.length ? (
          <table className="w-full text-sm">
            <thead className="bg-white/70 text-muted">
              <tr>
                <th className="p-3 text-left">Request</th>
                <th className="p-3 text-left">Client / matter</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Sent</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t border-border hover:bg-white/60">
                  <td className="p-3">
                    <Link href={`/app/intake/${request.id}` as any} className="font-medium text-accent">{request.title}</Link>
                    <p className="mt-1 text-xs text-muted">Created by {request.createdByUser.name}</p>
                  </td>
                  <td className="p-3 text-muted">
                    {request.client ? `${request.client.firstName} ${request.client.lastName}` : request.recipientName || "Unlinked client"}
                    {request.matter ? <p className="text-xs">{request.matter.title}</p> : null}
                  </td>
                  <td className="p-3">{request.status.toLowerCase()}</td>
                  <td className="p-3 text-muted">{request.createdAt.toLocaleDateString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-muted">No intake requests have been sent yet. Create one above to launch the secure client intake portal.</p>
        )}
      </div>
    </AppShell>
  );
}
