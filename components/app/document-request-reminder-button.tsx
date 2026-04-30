"use client";

import { useState } from "react";
import { SecondaryButton } from "@/components/ui/secondary-button";

export function DocumentRequestReminderButton({ requestId }: { requestId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    setMessage(null);
    setLink(null);
    setError(null);
    setIsSubmitting(true);
    const response = await fetch(`/api/document-requests/${requestId}/reminder`, { method: "POST" });
    const result = await response.json().catch(() => null) as { error?: string; emailDelivery?: { reason?: string }; link?: string } | null;
    setIsSubmitting(false);
    if (!response.ok) {
      setError(result?.error ?? "Unable to send the reminder.");
      return;
    }
    setMessage(result?.emailDelivery?.reason ?? "Reminder sent.");
    setLink(result?.link ?? null);
  }

  return (
    <div className="space-y-2">
      <SecondaryButton type="button" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? "Sending reminder..." : "Send reminder"}
      </SecondaryButton>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
      {link ? <p className="break-all rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">{link}</p> : null}
      {error ? <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
