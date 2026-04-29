"use client";

import { useState } from "react";

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
      <button type="button" onClick={handleClick} disabled={isSubmitting} className="rounded-lg border border-border bg-white/70 px-3 py-2 text-sm text-accent disabled:opacity-60">
        {isSubmitting ? "Sending reminder..." : "Send reminder"}
      </button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
      {link ? <p className="break-all text-xs text-muted">{link}</p> : null}
      {error ? <p className="text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
