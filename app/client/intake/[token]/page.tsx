import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { markIntakeViewed, submitIntake } from "@/lib/services/client-workflows";

export default async function ClientIntakePage({ params, searchParams }: { params: { token: string }; searchParams?: { submitted?: string } }) {
  const request = await markIntakeViewed(params.token);
  if (!request) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
          <h1 className="mt-2 text-2xl font-semibold">Intake link unavailable</h1>
          <p className="mt-3 text-sm text-muted">This intake link is invalid, expired, or has already been closed. Ask your migration team to send a fresh secure link.</p>
        </Card>
      </div>
    );
  }

  async function handleSubmit(formData: FormData) {
    "use server";
    const payload = {
      fullName: String(formData.get("fullName") || ""),
      currentVisaStatus: String(formData.get("currentVisaStatus") || ""),
      currentVisaExpiry: String(formData.get("currentVisaExpiry") || ""),
      passportNumber: String(formData.get("passportNumber") || ""),
      educationHistory: String(formData.get("educationHistory") || ""),
      employmentHistory: String(formData.get("employmentHistory") || ""),
      englishLevel: String(formData.get("englishLevel") || ""),
      familyDetails: String(formData.get("familyDetails") || ""),
      location: String(formData.get("location") || ""),
      constraints: String(formData.get("constraints") || ""),
      preferredVisaGoal: String(formData.get("preferredVisaGoal") || ""),
      notes: String(formData.get("notes") || "")
    };

    await submitIntake(params.token, payload);
    redirect(`/client/intake/${params.token}?submitted=1`);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-3xl p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
        <h1 className="mt-2 text-2xl font-semibold">{request.title}</h1>
        <p className="mt-3 text-sm text-muted">Provide accurate information for your migration team. This is an AI-assisted intake workflow and will be reviewed by a registered migration agent.</p>
        {searchParams?.submitted === "1" ? (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Your intake has been submitted. Your migration team will review it and follow up with any next steps.
          </div>
        ) : null}
        <form action={handleSubmit} className="mt-6 grid gap-3 md:grid-cols-2">
          <input name="fullName" defaultValue={request.client ? `${request.client.firstName} ${request.client.lastName}` : ""} placeholder="Full name" className="rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <input name="currentVisaStatus" placeholder="Current visa status" className="rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <input name="currentVisaExpiry" type="date" className="rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <input name="passportNumber" placeholder="Passport number" className="rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <textarea name="educationHistory" placeholder="Education history" className="min-h-24 rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <textarea name="employmentHistory" placeholder="Employment history" className="min-h-24 rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <input name="englishLevel" placeholder="English level / tests" className="rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <input name="location" placeholder="Current location" className="rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <textarea name="familyDetails" placeholder="Partner / family details" className="min-h-24 rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <textarea name="constraints" placeholder="Refusals, cancellations, health, character, timing constraints" className="min-h-24 rounded-lg border border-border bg-white/80 p-3 text-sm" />
          <input name="preferredVisaGoal" placeholder="Preferred visa goal" className="rounded-lg border border-border bg-white/80 p-3 text-sm md:col-span-2" />
          <textarea name="notes" placeholder="Anything else your migration team should know" className="min-h-32 rounded-lg border border-border bg-white/80 p-3 text-sm md:col-span-2" />
          <button className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white md:col-span-2">Submit intake</button>
        </form>
      </Card>
    </div>
  );
}
