"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MatterChecklist = {
  id: string;
  title: string;
  visaSubclass: string;
  client: { id: string; firstName: string; lastName: string; email: string };
  checklistItems: Array<{ id: string; label: string; category: string; status: string }>;
};

export function DocumentRequestForm({ matters }: { matters: MatterChecklist[] }) {
  const router = useRouter();
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const matter = useMemo(() => matters.find((item) => item.id === selectedMatterId) ?? null, [matters, selectedMatterId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matter) {
      setError("Choose a matter first.");
      return;
    }
    setError(null);
    setMessage(null);
    setLink(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const checklistItemIds = form.getAll("checklistItemIds").map(String);
    const payload = {
      matterId: matter.id,
      clientId: matter.client.id,
      checklistItemIds,
      dueDate: String(form.get("dueDate") || ""),
      recipientName: String(form.get("recipientName") || ""),
      recipientEmail: String(form.get("recipientEmail") || ""),
      message: String(form.get("message") || "")
    };

    const response = await fetch("/api/document-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as { error?: string; link?: string; emailDelivery?: { reason?: string } } | null;
    setIsSubmitting(false);

    if (!response.ok) {
      setError(result?.error ?? "Unable to send the document request.");
      return;
    }

    setMessage(result?.emailDelivery?.reason ?? "Document request created.");
    setLink(result?.link ?? null);
    event.currentTarget.reset();
    setSelectedMatterId("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <select value={selectedMatterId} onChange={(event) => setSelectedMatterId(event.target.value)} className="rounded-lg border border-border bg-white/70 p-2 text-sm">
          <option value="">Choose matter</option>
          {matters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.client.firstName} {item.client.lastName} - {item.visaSubclass} - {item.title}
            </option>
          ))}
        </select>
        <input name="dueDate" type="date" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
        <input name="recipientName" defaultValue={matter ? `${matter.client.firstName} ${matter.client.lastName}` : ""} placeholder="Client name" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
        <input name="recipientEmail" type="email" defaultValue={matter?.client.email ?? ""} placeholder="Client email" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      </div>

      {matter ? (
        <div className="rounded-xl border border-border bg-white/55 p-3">
          <p className="text-sm font-medium">Checklist items</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {matter.checklistItems.map((item) => (
              <label key={item.id} className="flex items-start gap-2 rounded-lg border border-border bg-white/75 p-3 text-sm">
                <input type="checkbox" name="checklistItemIds" value={item.id} className="mt-1" />
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="mt-1 block text-xs text-muted">{item.category} - {item.status.toLowerCase()}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-white/55 p-3 text-sm text-muted">Choose a matter to select real checklist items from the database.</p>
      )}

      <textarea name="message" placeholder="Message for the client" className="min-h-28 w-full rounded-lg border border-border bg-white/70 p-2 text-sm" />
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p> : null}
      {message ? (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          <p>{message}</p>
          {link ? <p className="mt-2 break-all text-xs text-emerald-50">{link}</p> : null}
        </div>
      ) : null}
      <button disabled={isSubmitting} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {isSubmitting ? "Sending request..." : "Send document request"}
      </button>
    </form>
  );
}
