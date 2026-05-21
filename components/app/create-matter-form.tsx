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
  { subclassCode: "500", title: "Subclass 500 - Student visa", stream: "Higher Education" },
  { subclassCode: "482", title: "Subclass 482 - Skills in Demand / employer sponsored", stream: "Employer sponsored" },
  { subclassCode: "820/801", title: "Subclass 820/801 - Partner onshore", stream: "Partner onshore" },
  { subclassCode: "600", title: "Subclass 600 - Visitor", stream: "Tourist" },
  { subclassCode: "190", title: "Subclass 190 - Skilled nominated", stream: "State nominated" }
];

const cleanSubclassLabels: Record<string, string> = {
  "500": "Subclass 500 - Student visa",
  "482": "Subclass 482 - Skills in Demand / employer sponsored",
  "820": "Subclass 820/801 - Partner onshore",
  "820/801": "Subclass 820/801 - Partner onshore",
  "600": "Subclass 600 - Visitor",
  "190": "Subclass 190 - Skilled nominated",
  "189": "Subclass 189 - Skilled independent",
  "491": "Subclass 491 - Skilled regional",
  "485": "Subclass 485 - Temporary Graduate",
  "186": "Subclass 186 - Employer Nomination Scheme",
  "309/100": "Subclass 309/100 - Partner offshore"
};

function cleanOptionLabel(option: VisaOption) {
  const code = option.subclassCode || "";
  if (cleanSubclassLabels[code]) return cleanSubclassLabels[code];
  const title = option.title.replace(/^\[PDF\]\s*/i, "").replace(/\s+/g, " ").trim();
  return code ? `Subclass ${code} - ${title.replace(/^Subclass\s+\S+\s*[-–—:]?\s*/i, "")}` : title;
}

function cleanOptions(visaOptions: VisaOption[]) {
  const merged = [...fallbackOptions, ...visaOptions.filter((option) => option.subclassCode)];
  const seen = new Set<string>();
  return merged.filter((option) => {
    const code = option.subclassCode || "";
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

export function CreateMatterForm({ visaOptions = [] }: { visaOptions?: VisaOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const options = cleanOptions(visaOptions);

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
              {cleanOptionLabel(option)}
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
