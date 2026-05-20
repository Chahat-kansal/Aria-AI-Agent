import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Card } from "@/components/ui/card";
import { getClientPortalByToken, createAppointment } from "@/lib/services/client-workflows";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { checkRateLimit } from "@/lib/security/rate-limit";

function nextSlots(
  availability: Array<{ weekday: number; start: string; end: string }>,
  durationMinutes: number,
  minNoticeHours: number,
  timezone: string
) {
  const slots: Array<{ label: string; value: string }> = [];
  const now = new Date();
  const minStart = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  for (let dayOffset = 0; dayOffset < 14 && slots.length < 12; dayOffset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + dayOffset);
    const weekday = day.getDay();
    const windows = availability.filter((item) => item.weekday === weekday);
    for (const window of windows) {
      const [startHour, startMinute] = window.start.split(":").map(Number);
      const [endHour, endMinute] = window.end.split(":").map(Number);
      const start = new Date(day);
      start.setHours(startHour, startMinute, 0, 0);
      const end = new Date(day);
      end.setHours(endHour, endMinute, 0, 0);
      for (let cursor = new Date(start); cursor < end && slots.length < 12; cursor = new Date(cursor.getTime() + durationMinutes * 60 * 1000)) {
        if (cursor < minStart) continue;
        const nextEnd = new Date(cursor.getTime() + durationMinutes * 60 * 1000);
        if (nextEnd > end) continue;
        slots.push({
          value: cursor.toISOString(),
          label: cursor.toLocaleString("en-AU", { timeZone: timezone, weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        });
      }
    }
  }
  return slots;
}

export default async function ClientBookingPage({ params, searchParams }: { params: { token: string }; searchParams?: { booked?: string } }) {
  const portal = await getClientPortalByToken(params.token);
  if (!portal) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-2xl p-8">
          <h1 className="text-2xl font-semibold">Booking link unavailable</h1>
          <p className="mt-3 text-sm text-muted">This booking link is invalid or expired. Ask your migration team for a fresh secure link.</p>
        </Card>
      </div>
    );
  }
  const activePortal = portal;
  const settings = await getWorkspaceOperationalSettingsView(activePortal.workspaceId);
  const appointmentTypes = settings.appointmentTypes as Array<{ key: string; label: string; durationMinutes: number }>;
  const meetingMethods = settings.appointmentMeetingMethods as string[];
  const availability = settings.appointmentAvailability as Array<{ weekday: number; start: string; end: string }>;
  const hasAvailability = availability.length > 0;
  const defaultType = appointmentTypes[0] ?? { key: "consultation", label: "Consultation", durationMinutes: 45 };
  const availableSlots = hasAvailability
    ? nextSlots(availability, defaultType.durationMinutes, settings.appointmentMinNoticeHours, settings.appointmentTimezone)
    : [];

  async function handleSubmit(formData: FormData) {
    "use server";
    const startsAt = String(formData.get("startsAt") || formData.get("slot") || "");
    const meetingType = String(formData.get("meetingType") || defaultType.label);
    const meetingMethod = String(formData.get("meetingMethod") || "");
    const notes = String(formData.get("notes") || "");
    const consentAccepted = String(formData.get("consent") || "") === "on";
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
    const limit = checkRateLimit({ key: `portal.appointment:${ip}:${params.token.slice(0, 12)}`, limit: 5, windowMs: 10 * 60 * 1000 });
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime()) || !consentAccepted || !limit.allowed) {
      redirect(`/client/book/${params.token}`);
    }

    await createAppointment({
      workspaceId: activePortal.workspaceId,
      clientId: activePortal.clientId,
      matterId: activePortal.matterId || undefined,
      assignedToUserId: activePortal.matter?.assignedToUserId || undefined,
      requestedByName: `${activePortal.client.firstName} ${activePortal.client.lastName}`,
      requestedByEmail: activePortal.client.email,
      meetingType: `${meetingType}${meetingMethod ? ` · ${meetingMethod}` : ""}`,
      startsAt: date,
      notes
    });
    redirect(`/client/book/${params.token}?booked=1`);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-2xl p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
        <h1 className="mt-2 text-2xl font-semibold">Book an appointment</h1>
        <p className="mt-3 text-sm text-muted">Request a consultation with your migration team. A staff member will review and confirm the appointment.</p>
        {!hasAvailability ? (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            Availability is not configured. Submit a preferred time and the firm will confirm.
          </p>
        ) : null}
        <div className="mt-4">
          <AIReviewNotice variant="client" />
        </div>
        {searchParams?.booked === "1" ? (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Your appointment request has been recorded.
          </div>
        ) : null}
        <form action={handleSubmit} className="mt-6 grid gap-3">
          <select name="meetingType" defaultValue={defaultType.label} className="rounded-lg border border-border bg-white/80 p-3 text-sm">
            {appointmentTypes.map((type) => <option key={type.key} value={type.label}>{type.label}</option>)}
          </select>
          <select name="meetingMethod" className="rounded-lg border border-border bg-white/80 p-3 text-sm">
            {meetingMethods.map((method) => <option key={method} value={method}>{method}</option>)}
          </select>
          {hasAvailability && availableSlots.length ? (
            <select name="slot" required className="rounded-lg border border-border bg-white/80 p-3 text-sm md:col-span-2">
              <option value="">Select an available slot</option>
              {availableSlots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
            </select>
          ) : (
            <input name="startsAt" type="datetime-local" required className="rounded-lg border border-border bg-white/80 p-3 text-sm md:col-span-2" />
          )}
          <textarea name="notes" placeholder="Questions or availability notes" className="min-h-28 rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" name="consent" required className="mt-0.5" />
            <span>I understand my information will be provided to my migration agent and may be processed by Aria to assist with document review and drafting.</span>
          </label>
          <button className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white">Request appointment</button>
        </form>
      </Card>
    </div>
  );
}
