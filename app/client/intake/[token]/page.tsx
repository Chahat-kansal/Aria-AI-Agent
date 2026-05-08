import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { markIntakeViewed, submitIntake } from "@/lib/services/client-workflows";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import {
  buildClientConfirmationPrompts,
  buildMatterClientConfirmationItems,
  parseSubmittedClientConfirmations
} from "@/lib/services/client-confirmation";

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
  const confirmationItems = request.matterId ? await buildMatterClientConfirmationItems(request.matterId).catch(() => []) : [];
  const confirmationPrompts = buildClientConfirmationPrompts(confirmationItems);

  async function handleSubmit(formData: FormData) {
    "use server";
    const confirmationPayload = parseSubmittedClientConfirmations(formData, confirmationItems);
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
      notes: String(formData.get("notes") || ""),
      clientConfirmations: confirmationPayload
    };
    const consentAccepted = String(formData.get("consent") || "") === "on";
    if (!consentAccepted) {
      redirect(`/client/intake/${params.token}`);
    }

    await submitIntake(params.token, payload);
    redirect(`/client/intake/${params.token}?submitted=1`);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Card className="mx-auto max-w-3xl p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Client Portal</p>
        <h1 className="mt-2 text-2xl font-semibold">{request.title}</h1>
        <p className="mt-3 text-sm text-muted">Provide accurate information for your migration team. This is an AI-assisted intake workflow and will be reviewed by a registered migration agent.</p>
        {request.message ? (
          <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/8 p-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500 dark:text-violet-300">Requested confirmations</p>
            <p className="mt-2 whitespace-pre-wrap">{request.message}</p>
          </div>
        ) : null}
        <div className="mt-4">
          <AIReviewNotice variant="client" />
        </div>
        {searchParams?.submitted === "1" ? (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Your intake has been submitted. Your migration team will review it and follow up with any next steps.
          </div>
        ) : null}
        <form action={handleSubmit} className="mt-6 grid gap-3 md:grid-cols-2">
          {confirmationPrompts.length ? (
            <div className="md:col-span-2 space-y-4 rounded-2xl border border-violet-400/15 bg-violet-500/[0.05] p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500 dark:text-violet-300">Client confirmation tasks</p>
                <h2 className="mt-2 text-lg font-semibold">Confirm these details for your migration team</h2>
                <p className="mt-2 text-sm text-muted">These confirmations record your instructions and factual corrections only. They do not finalise legal conclusions and still require migration agent review.</p>
              </div>
              <div className="space-y-4">
                {confirmationPrompts.map((prompt) => (
                  <div key={prompt.key} className="rounded-2xl border border-white/10 bg-white/70 p-4 shadow-sm dark:bg-white/[0.03]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
                        {prompt.category.replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
                        {prompt.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold">{prompt.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{prompt.detail}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="rounded-xl border border-border bg-white/80 px-3 py-2 text-sm dark:bg-white/[0.04]">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted">Response</span>
                        <select name={prompt.responseKey} required defaultValue="confirmed" className="w-full rounded-lg bg-transparent text-sm outline-none">
                          <option value="confirmed">Confirmed</option>
                          <option value="needs_agent_follow_up">Needs agent follow-up</option>
                        </select>
                      </label>
                      <label className="rounded-xl border border-border bg-white/80 px-3 py-2 text-sm dark:bg-white/[0.04] md:col-span-2">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted">Details for your migration team</span>
                        <textarea
                          name={prompt.detailKey}
                          required={prompt.status === "required"}
                          placeholder="Add any corrections, clarifications, or facts your migration team should rely on."
                          className="min-h-24 w-full rounded-lg bg-transparent text-sm outline-none"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
          <label className="md:col-span-2 flex items-start gap-3 rounded-lg border border-border bg-white/80 p-3 text-sm text-slate-700">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>I understand my information will be provided to my migration agent and may be processed by Aria to assist with document review and drafting.</span>
          </label>
          <button className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white md:col-span-2">Submit intake</button>
        </form>
      </Card>
    </div>
  );
}
