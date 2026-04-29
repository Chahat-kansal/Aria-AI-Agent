import { NextResponse } from "next/server";
import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { createAppointment, ensureClientPortalToken } from "@/lib/services/client-workflows";
import { sendClientWorkflowEmail } from "@/lib/services/email";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  matterId: z.string().optional(),
  clientId: z.string().optional(),
  assignedToUserId: z.string().optional(),
  requestedByName: z.string().trim().optional(),
  requestedByEmail: z.string().trim().email().optional(),
  meetingType: z.string().trim().min(2),
  startsAt: z.string().min(1),
  notes: z.string().trim().optional(),
  status: z.nativeEnum(AppointmentStatus).optional()
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_manage_appointments")) {
      return NextResponse.json({ error: "You do not have permission to manage appointments." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid appointment details are required." }, { status: 400 });
    }

    if (parsed.data.matterId) {
      const matter = await prisma.matter.findFirst({
        where: { id: parsed.data.matterId, workspaceId: context.workspace.id },
        include: { assignedToUser: true, client: true }
      });
      if (!matter || !canAccessMatter(context.user, matter)) {
        return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
      }
    }

    const startsAt = new Date(parsed.data.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "A valid appointment date/time is required." }, { status: 400 });
    }

    const appointment = await createAppointment({
      workspaceId: context.workspace.id,
      clientId: parsed.data.clientId,
      matterId: parsed.data.matterId,
      assignedToUserId: parsed.data.assignedToUserId || context.user.id,
      requestedByName: parsed.data.requestedByName,
      requestedByEmail: parsed.data.requestedByEmail,
      status: parsed.data.status,
      meetingType: parsed.data.meetingType,
      startsAt,
      notes: parsed.data.notes
    });

    let portalLink: string | null = null;
    if (parsed.data.clientId) {
      portalLink = (await ensureClientPortalToken({
        workspaceId: context.workspace.id,
        clientId: parsed.data.clientId,
        matterId: parsed.data.matterId,
        label: "Appointment confirmation"
      })).url;
    }

    const emailDelivery = parsed.data.requestedByEmail
      ? await sendClientWorkflowEmail({
          to: parsed.data.requestedByEmail,
          recipientName: parsed.data.requestedByName || "Client",
          workspaceName: context.workspace.name,
          subject: `${context.workspace.name}: appointment ${appointment.status.toLowerCase()}`,
          intro: `Your ${parsed.data.meetingType.toLowerCase()} appointment is recorded for ${startsAt.toLocaleString("en-AU")}.`,
          actionLabel: portalLink ? "Review your secure client portal" : "Appointment recorded",
          actionLink: portalLink || (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, ""),
          footer: "Please contact your migration team if you need to reschedule."
        })
      : { delivered: false, reason: "No client email was supplied.", actionLink: portalLink };

    return NextResponse.json({ appointment, emailDelivery }, { status: 201 });
  } catch (error) {
    serverLog("appointment.create_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to create the appointment right now." }, { status: 500 });
  }
}
