import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { AppointmentForm } from "@/components/app/appointment-form";
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
      <Card className="mb-4">
        <h3 className="font-semibold">Book or record appointment</h3>
        <p className="mb-3 mt-1 text-sm text-muted">Create a consultation booking for a client matter. If email is configured, the confirmation is sent automatically.</p>
        <AppointmentForm matters={matters} assignees={users} />
      </Card>

      <div className="panel overflow-hidden">
        {appointments.length ? (
          <table className="w-full text-sm">
            <thead className="bg-white/70 text-muted">
              <tr>
                <th className="p-3 text-left">When</th>
                <th className="p-3 text-left">Matter</th>
                <th className="p-3 text-left">Assigned</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="border-t border-border hover:bg-white/60">
                  <td className="p-3">
                    <p className="font-medium">{appointment.meetingType}</p>
                    <p className="text-xs text-muted">{appointment.startsAt.toLocaleString("en-AU")}</p>
                  </td>
                  <td className="p-3 text-muted">{appointment.matter?.title || "Unlinked matter"}</td>
                  <td className="p-3 text-muted">{appointment.assignedToUser?.name || "Unassigned"}</td>
                  <td className="p-3">{appointment.status.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-muted">No appointments are booked yet. Create one above or let a client request one through a secure portal link.</p>
        )}
      </div>
    </AppShell>
  );
}
