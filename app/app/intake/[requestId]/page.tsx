import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export default async function IntakeRequestDetailPage({ params }: { params: { requestId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_send_client_requests")) {
    return (
      <AppShell title="Client Intake">
        <PageHeader title="Client intake unavailable" subtitle="Your company administrator controls client intake request access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to view intake requests.</p></Card>
      </AppShell>
    );
  }

  const request = await prisma.clientIntakeRequest.findFirst({
    where: { id: params.requestId, workspaceId: context.workspace.id, ...(context.user ? { matter: scopedMatterWhere(context.user) } : {}) },
    include: { client: true, matter: true, createdByUser: true }
  });
  if (!request) notFound();

  const questionnaire = (request.questionnaireJson as Record<string, unknown> | null) ?? null;

  return (
    <AppShell title="Client Intake">
      <PageHeader title={request.title} subtitle="Secure intake request record with submission status and captured questionnaire data." />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold tracking-tight text-white">Request overview</h3>
            <StatusPill>{request.status.toLowerCase()}</StatusPill>
          </div>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <div className="aria-note">Status<br /><span className="text-white">{request.status.toLowerCase()}</span></div>
            <div className="aria-note">Recipient<br /><span className="text-white">{request.recipientName || request.recipientEmail || "Not set"}</span></div>
            <div className="aria-note">Viewed<br /><span className="text-white">{request.viewedAt ? request.viewedAt.toLocaleString("en-AU") : "Not yet"}</span></div>
            <div className="aria-note">Submitted<br /><span className="text-white">{request.submittedAt ? request.submittedAt.toLocaleString("en-AU") : "Not yet"}</span></div>
          </div>
          {request.message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">{request.message}</p> : null}
        </Card>
        <Card>
          <h3 className="text-xl font-semibold tracking-tight text-white">Linked records</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>Client: {request.client ? `${request.client.firstName} ${request.client.lastName}` : "Not linked"}</p>
            <p>Matter: {request.matter?.title || "Not linked"}</p>
            <p>Created by: {request.createdByUser.name}</p>
            <p>Expires: {request.expiresAt.toLocaleDateString("en-AU")}</p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="text-xl font-semibold tracking-tight text-white">Submitted questionnaire</h3>
        {questionnaire ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {Object.entries(questionnaire).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{key.replace(/([A-Z])/g, " $1")}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-200">{typeof value === "string" ? value : JSON.stringify(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">No questionnaire submission has been recorded yet.</p>
        )}
      </Card>
    </AppShell>
  );
}
