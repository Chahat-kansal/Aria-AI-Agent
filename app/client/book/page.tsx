import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAppointment } from "@/lib/services/client-workflows";
import { getClientPortalSession } from "@/lib/services/client-portal-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { PortalCard, PortalSectionHeading, PortalShell, PortalStatusBadge } from "@/components/client-portal/portal-ui";
import { getWorkspaceAppointmentBookingExperience } from "@/lib/services/calendar/calendar-integration";

function fallbackDateTime(formData: FormData) {
  const preferredDate = String(formData.get("preferredDate") || "");
  const preferredWindow = String(formData.get("preferredWindow") || "morning");
  const date = preferredDate ? new Date(`${preferredDate}T${preferredWindow === "afternoon" ? "14:00" : preferredWindow === "evening" ? "17:00" : "10:00"}:00`) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return date;
}

export default async function ClientBookingSessionPage({ searchParams }: { searchParams?: { booked?: string } }) {
  const portal = await getClientPortalSession();
  if (!portal) redirect("/client/login");
  const booking = await getWorkspaceAppointmentBookingExperience({ workspaceId: portal.workspaceId, userId: portal.matter?.assignedToUserId || "" });
  const appointmentTypes = booking.appointmentTypes;
  const meetingMethods = booking.meetingMethods;
  const defaultType = booking.defaultType;
  const availableSlots = booking.availableSlots;

  async function handleSubmit(formData: FormData) {
    "use server";
    const activePortal = await getClientPortalSession();
    if (!activePortal) redirect("/client/login");
    const slot = String(formData.get("slot") || "");
    const meetingType = String(formData.get("meetingType") || defaultType.label);
    const meetingMethod = String(formData.get("meetingMethod") || "");
    const notes = String(formData.get("notes") || "");
    const consentAccepted = String(formData.get("consent") || "") === "on";
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
    const limit = checkRateLimit({ key: `portal.appointment:${ip}:${activePortal.id}`, limit: 5, windowMs: 10 * 60 * 1000 });
    const startsAt = slot ? new Date(slot) : fallbackDateTime(formData);
    if (Number.isNaN(startsAt.getTime()) || !consentAccepted || !limit.allowed) redirect(`/client/book`);
    await createAppointment({
      workspaceId: activePortal.workspaceId,
      clientId: activePortal.clientId,
      matterId: activePortal.matterId || undefined,
      assignedToUserId: activePortal.matter?.assignedToUserId || undefined,
      requestedByName: `${activePortal.client.firstName} ${activePortal.client.lastName}`,
      requestedByEmail: activePortal.client.email,
      meetingType: `${meetingType}${meetingMethod ? ` - ${meetingMethod}` : ""}`,
      startsAt,
      notes
    });
    redirect(`/client/book?booked=1`);
  }

  return (
    <PortalShell firmName={portal.workspace.name} clientName={`${portal.client.firstName} ${portal.client.lastName}`} matterTitle={portal.matter?.title} subclass={portal.matter?.visaSubclass}>
      <div className="mx-auto max-w-4xl space-y-6">
        <PortalCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <PortalSectionHeading eyebrow="Appointment" title="Request an appointment" description="Choose a live slot if one is available, or send preferred timing for your migration team to confirm." />
            <PortalStatusBadge tone={searchParams?.booked === "1" ? "success" : "info"}>{searchParams?.booked === "1" ? "Requested" : "Agent confirmation required"}</PortalStatusBadge>
          </div>
          {searchParams?.booked === "1" ? <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Appointment request sent. Status: Waiting for team confirmation.</div> : null}
        </PortalCard>
        <PortalCard>
          {availableSlots.length ? (
            <PortalSectionHeading title="Choose an available time" description={`Select one of the available appointment times below. ${booking.providerDetail}`} />
          ) : (
            <PortalSectionHeading title="No live availability is configured yet" description={`Send your preferred date and time window. Your migration team will confirm manually. ${booking.providerDetail}`} />
          )}
          <form action={handleSubmit} className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2"><span className="text-sm font-medium text-slate-800">Appointment type</span><select name="meetingType" defaultValue={defaultType.label} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-cyan-300/30">{appointmentTypes.map((type) => <option key={type.key} value={type.label}>{type.label}</option>)}</select></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-800">Meeting method</span><select name="meetingMethod" className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-cyan-300/30">{meetingMethods.map((method) => <option key={method} value={method}>{method}</option>)}{!meetingMethods.length ? <option value="video">Video call</option> : null}</select></label>
            </div>
            {availableSlots.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {availableSlots.map((slot, index) => (
                  <label key={slot.value} className="cursor-pointer rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 transition hover:bg-violet-50">
                    <input type="radio" name="slot" value={slot.value} required={availableSlots.length > 0} defaultChecked={index === 0} className="mr-2" />
                    {slot.label}
                  </label>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2"><span className="text-sm font-medium text-slate-800">Preferred date</span><input name="preferredDate" type="date" required className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-cyan-300/30" /></label>
                <label className="space-y-2"><span className="text-sm font-medium text-slate-800">Preferred time window</span><select name="preferredWindow" className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-cyan-300/30"><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">After hours / evening</option></select></label>
              </div>
            )}
            <textarea name="notes" placeholder="Questions or availability notes" className="min-h-28 w-full rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-950 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-300/30" />
            <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <input type="checkbox" name="consent" required className="mt-1" />
              <span>I understand my migration team will review and confirm this appointment request.</span>
            </label>
            <button className="rounded-2xl bg-violet-700 px-5 py-3 text-sm font-semibold text-[#fff]">Request appointment</button>
          </form>
        </PortalCard>
        <Link href={"/client/portal" as any} className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-950">Back to portal home</Link>
      </div>
    </PortalShell>
  );
}
