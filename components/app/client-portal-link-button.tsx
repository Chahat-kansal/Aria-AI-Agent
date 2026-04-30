"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/primary-button";

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
      <PrimaryButton type="button" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? "Creating portal link..." : "Create client portal link"}
      </PrimaryButton>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
      {link ? <p className="break-all rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">{link}</p> : null}
      {error ? <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
