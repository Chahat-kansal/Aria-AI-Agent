"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/primary-button";

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
        <select value={selectedMatterId} onChange={(event) => setSelectedMatterId(event.target.value)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15">
          <option value="">Choose matter</option>
          {matters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.client.firstName} {item.client.lastName} - {item.visaSubclass} - {item.title}
            </option>
          ))}
        </select>
        <input name="dueDate" type="date" className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" />
        <input name="recipientName" defaultValue={matter ? `${matter.client.firstName} ${matter.client.lastName}` : ""} placeholder="Client name" className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" />
        <input name="recipientEmail" type="email" defaultValue={matter?.client.email ?? ""} placeholder="Client email" className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" />
      </div>

      {matter ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-white">Checklist items</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {matter.checklistItems.map((item) => (
              <label key={item.id} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-sm">
                <input type="checkbox" name="checklistItemIds" value={item.id} className="mt-1" />
                <span>
                  <span className="font-medium text-white">{item.label}</span>
                  <span className="mt-1 block text-xs text-slate-400">{item.category} - {item.status.toLowerCase()}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">Choose a matter to select real checklist items from the database.</p>
      )}

      <textarea name="message" placeholder="Message for the client" className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" />
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p> : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          <p>{message}</p>
          {link ? <p className="mt-2 break-all text-xs text-emerald-50">{link}</p> : null}
        </div>
      ) : null}
      <PrimaryButton disabled={isSubmitting}>
        {isSubmitting ? "Sending request..." : "Send document request"}
      </PrimaryButton>
    </form>
  );
}
