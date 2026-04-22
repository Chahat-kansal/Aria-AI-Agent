"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type VisaOption = {
  subclassCode: string | null;
  title: string;
  stream: string | null;
};

const fallbackOptions = [
  { subclassCode: "500", title: "Student visa Subclass 500", stream: "Higher Education" },
  { subclassCode: "189", title: "Skilled Independent Subclass 189", stream: "Points-tested" },
  { subclassCode: "190", title: "Skilled Nominated Subclass 190", stream: "State nominated" },
  { subclassCode: "482", title: "Skills in Demand / TSS Subclass 482", stream: "Employer sponsored" },
  { subclassCode: "820", title: "Partner visa Subclass 820", stream: "Onshore" }
];

export function CreateMatterForm({ visaOptions = [] }: { visaOptions?: VisaOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const options = visaOptions.length ? visaOptions.filter((option) => option.subclassCode) : fallbackOptions;

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
        {options.map((option) => (
          <option key={`${option.subclassCode}-${option.title}`} value={option.subclassCode ?? ""}>
            {option.title}
          </option>
        ))}
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
