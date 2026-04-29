"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type MatterOption = {
  id: string;
  title: string;
  client: { id: string; firstName: string; lastName: string; email: string };
};

type AssigneeOption = { id: string; name: string; email: string };

export function AppointmentForm({ matters, assignees }: { matters: MatterOption[]; assignees: AssigneeOption[] }) {
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
    const payload = Object.fromEntries(form.entries());
    if (!payload.matterId) delete payload.matterId;
    if (!payload.clientId) delete payload.clientId;
    if (!payload.assignedToUserId) delete payload.assignedToUserId;
    if (!payload.requestedByName) delete payload.requestedByName;
    if (!payload.requestedByEmail) delete payload.requestedByEmail;
    if (!payload.notes) delete payload.notes;

    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as { error?: string; emailDelivery?: { reason?: string } } | null;
    setIsSubmitting(false);
    if (!response.ok) {
      setError(result?.error ?? "Unable to create the appointment.");
      return;
    }
    setMessage(result?.emailDelivery?.reason ?? "Appointment recorded.");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <select name="matterId" className="rounded-lg border border-border bg-white/70 p-2 text-sm" defaultValue="">
        <option value="">Unlinked appointment</option>
        {matters.map((matter) => (
          <option key={matter.id} value={matter.id}>
            {matter.client.firstName} {matter.client.lastName} - {matter.title}
          </option>
        ))}
      </select>
      <select name="assignedToUserId" className="rounded-lg border border-border bg-white/70 p-2 text-sm" defaultValue="">
        <option value="">Assigned staff member</option>
        {assignees.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name || user.email}
          </option>
        ))}
      </select>
      <input name="meetingType" required placeholder="Consultation type" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <input name="startsAt" required type="datetime-local" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <input name="requestedByName" placeholder="Client / attendee name" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <input name="requestedByEmail" type="email" placeholder="Client email for confirmation" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <textarea name="notes" placeholder="Notes or agenda" className="min-h-28 rounded-lg border border-border bg-white/70 p-2 text-sm md:col-span-2" />
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200 md:col-span-2">{error}</p> : null}
      {message ? <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-sm text-emerald-100 md:col-span-2">{message}</p> : null}
      <button disabled={isSubmitting} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2">
        {isSubmitting ? "Saving appointment..." : "Save appointment"}
      </button>
    </form>
  );
}
