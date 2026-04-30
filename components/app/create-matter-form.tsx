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

    router.push(`/app/matters/${payload.matter.id}` as any);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <input name="clientFirstName" required placeholder="Client first name" />
      <input name="clientLastName" required placeholder="Client last name" />
      <input name="clientEmail" required type="email" placeholder="Client email" />
      <input name="clientPhone" placeholder="Client phone" />
      <input name="clientDob" type="date" />
      <input name="nationality" placeholder="Nationality" />
      <input name="title" required placeholder="Matter title" />
      <select name="visaSubclass" defaultValue="500">
        {options.map((option) => (
          <option key={`${option.subclassCode}-${option.title}`} value={option.subclassCode ?? ""}>
            {option.title}
          </option>
        ))}
      </select>
      <input name="visaStream" required defaultValue="Higher Education" placeholder="Stream" />
      <input name="lodgementTargetDate" type="date" />
      {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300 md:col-span-2">{error}</p> : null}
      <button disabled={isSubmitting} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95 disabled:opacity-60 md:col-span-2">
        {isSubmitting ? "Creating matter..." : "Create matter"}
      </button>
    </form>
  );
}
