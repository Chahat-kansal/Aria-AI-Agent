"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type GeneratedDocumentType =
  | "COVER_LETTER"
  | "STATUTORY_DECLARATION_TEMPLATE"
  | "DOCUMENT_REQUEST_CHECKLIST"
  | "SKILLS_ASSESSMENT_CHECKLIST"
  | "SPONSORSHIP_CHECKLIST"
  | "CHARACTER_REFERENCE_TEMPLATE"
  | "GENUINE_STUDENT_STATEMENT_OUTLINE";

const documentOptions: Array<{ value: GeneratedDocumentType; label: string }> = [
  { value: "COVER_LETTER", label: "Cover letter" },
  { value: "STATUTORY_DECLARATION_TEMPLATE", label: "Statutory declaration template" },
  { value: "DOCUMENT_REQUEST_CHECKLIST", label: "Document request checklist" },
  { value: "SKILLS_ASSESSMENT_CHECKLIST", label: "Skills assessment checklist" },
  { value: "SPONSORSHIP_CHECKLIST", label: "Sponsorship checklist" },
  { value: "CHARACTER_REFERENCE_TEMPLATE", label: "Character reference template" },
  { value: "GENUINE_STUDENT_STATEMENT_OUTLINE", label: "Genuine student statement outline" }
];

export function GeneratedDocumentForm({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/generated-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matterId,
        type: form.get("type")
      })
    });

    const result = await response.json().catch(() => null) as { error?: string } | null;
    setIsSubmitting(false);

    if (!response.ok) {
      setError(result?.error ?? "Unable to generate the requested document.");
      return;
    }

    setMessage("Generated document created. Review required before client use.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted">Document type</label>
        <select name="type" defaultValue="COVER_LETTER" className="rounded-lg border border-border bg-white/70 p-2 text-sm">
          {documentOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <button disabled={isSubmitting} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {isSubmitting ? "Generating..." : "Generate document"}
      </button>
      {error ? <p className="basis-full rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p> : null}
      {message ? <p className="basis-full rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-sm text-emerald-100">{message}</p> : null}
    </form>
  );
}
