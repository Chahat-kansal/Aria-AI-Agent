"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type MatterOption = {
  id: string;
  title: string;
  visaSubclass: string;
  client: { firstName: string; lastName: string };
};

export function PathwayAnalysisForm({ matters }: { matters: MatterOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    if (!payload.matterId) delete payload.matterId;
    if (!payload.age) delete payload.age;

    const response = await fetch("/api/pathways", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => null) as { analysis?: { id: string }; error?: string } | null;
    setIsSubmitting(false);

    if (!response.ok || !result?.analysis) {
      setError(result?.error ?? "Unable to create pathway analysis.");
      return;
    }

    router.push(`/app/pathways/${result.analysis.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <input name="title" placeholder="Analysis title" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <select name="matterId" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" defaultValue="">
        <option value="">No linked matter yet</option>
        {matters.map((matter) => (
          <option key={matter.id} value={matter.id}>
            {matter.client.firstName} {matter.client.lastName} - {matter.visaSubclass} - {matter.title}
          </option>
        ))}
      </select>
      <input name="currentVisaStatus" placeholder="Current visa status and expiry" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="age" type="number" min="0" max="100" placeholder="Age" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="occupation" placeholder="Occupation / nominated role" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="anzscoCode" placeholder="ANZSCO code if known" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="studyHistory" placeholder="Study history" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="location" placeholder="Current location / regional context" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="familyStatus" placeholder="Family / partner context" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="workExperience" placeholder="Work experience summary" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="englishLevel" placeholder="English level / test result" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="employerSponsorship" placeholder="Employer sponsorship context" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <textarea name="residenceHistory" placeholder="Residence and travel history" className="min-h-24 rounded-lg border border-border bg-[#0d1728] p-2 text-sm md:col-span-2" />
      <textarea name="constraints" placeholder="Constraints: refusals, cancellations, health, character, timing" className="min-h-24 rounded-lg border border-border bg-[#0d1728] p-2 text-sm md:col-span-2" />
      <textarea name="freeText" placeholder="Client situation in their own words" className="min-h-28 rounded-lg border border-border bg-[#0d1728] p-2 text-sm md:col-span-2" />
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200 md:col-span-2">{error}</p> : null}
      <button disabled={isSubmitting} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2">
        {isSubmitting ? "Creating analysis..." : "Create AI-assisted pathway analysis"}
      </button>
    </form>
  );
}
