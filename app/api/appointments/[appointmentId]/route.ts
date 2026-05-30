import { NextResponse } from "next/server";
import { AppointmentStatus } from "@prisma/client";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { syncAppointmentToCalendar } from "@/lib/services/calendar/calendar-sync";

export async function PATCH(req: Request, { params }: { params: { appointmentId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_manage_appointments")) {
    return NextResponse.json({ error: "You do not have permission to manage appointments." }, { status: 403 });
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, workspaceId: context.workspace.id },
    include: { matter: { include: { assignedToUser: true } } }
  });
  if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  if (appointment.matter && !canAccessMatter(context.user, appointment.matter)) {
    return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    status?: AppointmentStatus;
    startsAt?: string;
    meetingType?: string;
    notes?: string;
    calendarAction?: "sync";
    dryRun?: boolean;
  } | null;
  const nextStartsAt = body?.startsAt ? new Date(body.startsAt) : undefined;
  if (nextStartsAt && Number.isNaN(nextStartsAt.getTime())) {
    return NextResponse.json({ error: "A valid appointment date/time is required." }, { status: 400 });
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: body?.status,
      startsAt: nextStartsAt,
      meetingType: body?.meetingType,
      notes: body?.notes
    }
  });

  await auditEvent({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    entityType: "Appointment",
    entityId: updated.id,
    action: "updated",
    metadata: { status: updated.status, startsAt: updated.startsAt.toISOString() }
  });

  const shouldSync = body?.calendarAction === "sync" || Boolean(body?.status || body?.startsAt || body?.meetingType || body?.notes);
  const calendarSync = shouldSync
    ? await syncAppointmentToCalendar({
        workspaceId: context.workspace.id,
        appointmentId: updated.id,
        userId: context.user.id,
        dryRun: body?.dryRun
      }).catch((error) => ({
        ok: false,
        state: "FAILED",
        reason: error instanceof Error ? error.message : String(error)
      }))
    : null;

  return NextResponse.json({
    ok: true,
    appointment: updated,
    calendarSync: calendarSync ? {
      ok: calendarSync.ok,
      state: calendarSync.state,
      reason: "reason" in calendarSync ? calendarSync.reason : null
    } : null
  });
}
