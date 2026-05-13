"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import type { DraftPdfSettings } from "@/lib/services/draft-pdf-settings";

export function DraftPdfSettingsForm({ settings }: { settings: DraftPdfSettings }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/settings/forms/draft-pdf-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        termsText: form.get("termsText"),
        footerText: form.get("footerText")
      })
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    setIsSaving(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to save draft PDF settings.");
      return;
    }

    setMessage("Firm PDF draft settings saved.");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <label className="grid gap-2 text-sm text-slate-300">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Draft PDF terms / conditions</span>
        <textarea
          name="termsText"
          defaultValue={settings.termsText}
          rows={6}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">PDF footer notice</span>
        <textarea
          name="footerText"
          defaultValue={settings.footerText}
          rows={3}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        />
      </label>
      <GradientButton type="submit" disabled={isSaving || isPending}>
        {isSaving ? "Saving PDF settings..." : "Save PDF settings"}
      </GradientButton>
      {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </form>
  );
}

