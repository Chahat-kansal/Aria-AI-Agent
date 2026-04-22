"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function CreateMatterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/matters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });

    const payload = await response.json().catch(() => null) as { matter?: { id: string }; error?: string } | null;
    setIsSubmitting(false);

    if (!response.ok || !payload?.matter) {
      setError(payload?.error ?? "Unable to create matter.");
      return;
    }

    router.push(`/app/matters/${payload.matter.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <input name="clientFirstName" required placeholder="Client first name" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="clientLastName" required placeholder="Client last name" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="clientEmail" required type="email" placeholder="Client email" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="clientPhone" placeholder="Client phone" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="clientDob" type="date" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="nationality" placeholder="Nationality" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="title" required placeholder="Matter title" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <select name="visaSubclass" defaultValue="500" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm">
        <option value="500">Student visa Subclass 500</option>
        <option value="189">Skilled Independent Subclass 189</option>
        <option value="190">Skilled Nominated Subclass 190</option>
        <option value="482">Skills in Demand / TSS Subclass 482</option>
        <option value="820">Partner visa Subclass 820</option>
      </select>
      <input name="visaStream" required defaultValue="Higher Education" placeholder="Stream" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      <input name="lodgementTargetDate" type="date" className="rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
      {error ? <p className="md:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p> : null}
      <button disabled={isSubmitting} className="md:col-span-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {isSubmitting ? "Creating matter..." : "Create matter"}
      </button>
    </form>
  );
}
