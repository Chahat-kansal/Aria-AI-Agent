"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { GradientButton } from "@/components/ui/gradient-button";

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
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <FormField label="Client first name">
        <input
          name="clientFirstName"
          required
          placeholder="Given name"
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </FormField>
      <FormField label="Client last name">
        <input
          name="clientLastName"
          required
          placeholder="Family name"
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </FormField>
      <FormField label="Client email">
        <input
          name="clientEmail"
          required
          type="email"
          placeholder="client@example.com"
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </FormField>
      <FormField label="Client phone">
        <input
          name="clientPhone"
          placeholder="+61 ..."
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </FormField>
      <FormField label="Date of birth">
        <input
          name="clientDob"
          type="date"
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </FormField>
      <FormField label="Nationality">
        <input
          name="nationality"
          placeholder="Nationality"
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </FormField>
      <FormField label="Matter title" className="md:col-span-2">
        <input
          name="title"
          required
          placeholder="e.g. Subclass 190 skilled migration pathway"
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </FormField>
      <FormField label="Visa subclass">
        <select
          name="visaSubclass"
          defaultValue="500"
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        >
          {options.map((option) => (
            <option key={`${option.subclassCode}-${option.title}`} value={option.subclassCode ?? ""}>
              {option.title}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Stream">
        <input
          name="visaStream"
          required
          defaultValue="Higher Education"
          placeholder="Stream"
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </FormField>
      <FormField label="Lodgement target date" className="md:col-span-2">
        <input
          name="lodgementTargetDate"
          type="date"
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </FormField>
      {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300 md:col-span-2">{error}</p> : null}
      <GradientButton type="submit" disabled={isSubmitting} className="md:col-span-2">
        {isSubmitting ? "Creating matter..." : "Create matter"}
      </GradientButton>
    </form>
  );
}
