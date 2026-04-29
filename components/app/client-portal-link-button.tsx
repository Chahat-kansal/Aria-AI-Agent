"use client";

import { useState } from "react";

export function ClientPortalLinkButton({ clientId, matterId }: { clientId: string; matterId?: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const response = await fetch("/api/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, matterId, label: "Client portal access" })
    });
    const result = await response.json().catch(() => null) as { error?: string; link?: string } | null;
    setIsSubmitting(false);
    if (!response.ok) {
      setError(result?.error ?? "Unable to create portal link.");
      return;
    }
    setLink(result?.link ?? null);
    setMessage("Secure client portal link created.");
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={handleClick} disabled={isSubmitting} className="rounded-lg border border-border bg-white/70 px-4 py-2 text-sm text-accent disabled:opacity-60">
        {isSubmitting ? "Creating portal link..." : "Create client portal link"}
      </button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
      {link ? <p className="break-all text-xs text-muted">{link}</p> : null}
      {error ? <p className="text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
