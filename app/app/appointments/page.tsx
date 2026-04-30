import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { AppointmentForm } from "@/components/app/appointment-form";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export default async function AppointmentsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_manage_appointments")) {
    return (
      <AppShell title="Appointments">
        <PageHeader title="Appointments unavailable" subtitle="Your company administrator controls consultation booking access." />
        <Card><p className="text-sm text-muted">You do not currently have permission to create or manage appointments.</p></Card>
      </AppShell>
    );
  }

  const [appointments, matters, users] = await Promise.all([
    prisma.appointment.findMany({
      where: { workspaceId: context.workspace.id, ...(context.user ? { OR: [{ matter: scopedMatterWhere(context.user) }, { assignedToUserId: context.user.id }] } : {}) },
      include: { matter: { include: { client: true } }, assignedToUser: true },
      orderBy: { startsAt: "asc" }
    }),
    prisma.matter.findMany({
      where: scopedMatterWhere(context.user),
      include: { client: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.user.findMany({
      where: { workspaceId: context.workspace.id, status: { not: "DISABLED" } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <AppShell title="Appointments">
      <PageHeader title="Appointments & Consultations" subtitle="Track real consultation requests, confirmations, and upcoming client meetings linked to staff and matters." />
      <Card className="mb-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Consultations</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Book or record appointment</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">Create a consultation booking for a client matter. If email is configured, the confirmation is sent automatically.</p>
          </div>
          <StatusPill tone="info">Client linked</StatusPill>
        </div>
        <AppointmentForm matters={matters} assignees={users} />
      </Card>

      <div className="aria-table-wrap">
        {appointments.length ? (
          <table className="w-full text-sm">
            <thead className="aria-table-head">
              <tr>
                <th className="aria-table-th">When</th>
                <th className="aria-table-th">Matter</th>
                <th className="aria-table-th">Assigned</th>
                <th className="aria-table-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="aria-table-row">
                  <td className="aria-table-td">
                    <p className="font-medium text-white">{appointment.meetingType}</p>
                    <p className="text-xs text-slate-400">{appointment.startsAt.toLocaleString("en-AU")}</p>
                  </td>
                  <td className="aria-table-td text-slate-300">{appointment.matter?.title || "Unlinked matter"}</td>
                  <td className="aria-table-td text-slate-300">{appointment.assignedToUser?.name || "Unassigned"}</td>
                  <td className="aria-table-td"><StatusPill>{appointment.status.toLowerCase()}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="No appointments booked"
            description="Create one above or let a client request one through a secure portal link."
          />
        )}
      </div>
    </AppShell>
  );
}
