import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getClientPortalByToken, createAppointment } from "@/lib/services/client-workflows";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";

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

  async function handleSubmit(formData: FormData) {
    "use server";
    const startsAt = String(formData.get("startsAt") || "");
    const meetingType = String(formData.get("meetingType") || "Consultation");
    const notes = String(formData.get("notes") || "");
    const consentAccepted = String(formData.get("consent") || "") === "on";
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime()) || !consentAccepted) {
      redirect(`/client/book/${params.token}`);
    }

    await createAppointment({
      workspaceId: activePortal.workspaceId,
      clientId: activePortal.clientId,
      matterId: activePortal.matterId || undefined,
      assignedToUserId: activePortal.matter?.assignedToUserId || undefined,
      requestedByName: `${activePortal.client.firstName} ${activePortal.client.lastName}`,
      requestedByEmail: activePortal.client.email,
      meetingType,
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
        <div className="mt-4">
          <AIReviewNotice variant="client" />
        </div>
        {searchParams?.booked === "1" ? (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Your appointment request has been recorded.
          </div>
        ) : null}
        <form action={handleSubmit} className="mt-6 grid gap-3">
          <input name="meetingType" defaultValue="Consultation" className="rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <input name="startsAt" type="datetime-local" required className="rounded-lg border border-border bg-white/80 p-3 text-sm" />
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
