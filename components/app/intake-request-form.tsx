"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type MatterOption = {
  id: string;
  title: string;
  visaSubclass: string;
  client: { firstName: string; lastName: string; email: string };
};

export function IntakeRequestForm({ matters }: { matters: MatterOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLink(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (!payload.matterId) delete payload.matterId;
    if (!payload.recipientName) delete payload.recipientName;
    if (!payload.recipientEmail) delete payload.recipientEmail;
    if (!payload.message) delete payload.message;

    const response = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => null) as { error?: string; link?: string; emailDelivery?: { reason?: string; delivered?: boolean } } | null;
    setIsSubmitting(false);

    if (!response.ok) {
      setError(result?.error ?? "Unable to create the intake request.");
      return;
    }

    setMessage(result?.emailDelivery?.reason ?? "Intake request created.");
    setLink(result?.link ?? null);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <input name="title" required placeholder="Intake request title" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <select name="matterId" defaultValue="" className="rounded-lg border border-border bg-white/70 p-2 text-sm">
        <option value="">Choose linked matter (optional)</option>
        {matters.map((matter) => (
          <option key={matter.id} value={matter.id}>
            {matter.client.firstName} {matter.client.lastName} - {matter.visaSubclass} - {matter.title}
          </option>
        ))}
      </select>
      <input name="recipientName" placeholder="Client name override (optional)" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <input name="recipientEmail" type="email" placeholder="Client email override (optional)" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <textarea name="message" placeholder="Message for the client" className="min-h-28 rounded-lg border border-border bg-white/70 p-2 text-sm md:col-span-2" />
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200 md:col-span-2">{error}</p> : null}
      {message ? (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100 md:col-span-2">
          <p>{message}</p>
          {link ? <p className="mt-2 break-all text-xs text-emerald-50">{link}</p> : null}
        </div>
      ) : null}
      <button disabled={isSubmitting} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2">
        {isSubmitting ? "Sending intake..." : "Create intake request"}
      </button>
    </form>
  );
}
