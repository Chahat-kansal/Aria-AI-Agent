"use client";

import { useState } from "react";
import { GradientButton } from "@/components/ui/gradient-button";
import { FormField } from "@/components/ui/form-field";

export function SecurityIncidentForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    setError(null);
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/settings/security/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(result?.error ?? "Unable to log incident.");
      return;
    }
    setMessage("Security incident logged.");
  }

  return (
    <>
      <form action={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <FormField label="Title"><input name="title" required className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" /></FormField>
        <FormField label="Category"><input name="category" required placeholder="Unauthorised access / disclosure / system issue" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" /></FormField>
        <FormField label="Severity"><input name="severity" required placeholder="Low / Medium / High / Critical" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" /></FormField>
        <FormField label="Affected entity type"><input name="affectedEntityType" placeholder="Matter / Client / Document" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" /></FormField>
        <FormField label="Affected entity id" className="md:col-span-2"><input name="affectedEntityId" placeholder="Optional record id" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" /></FormField>
        <FormField label="Containment steps" className="md:col-span-2"><textarea name="containmentSteps" className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" /></FormField>
        <FormField label="Assessment notes" className="md:col-span-2"><textarea name="assessmentNotes" className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" /></FormField>
        <FormField label="Notification status" className="md:col-span-2"><input name="notificationStatus" placeholder="Under assessment / not required / external advice pending" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" /></FormField>
        <div className="md:col-span-2">
          <GradientButton disabled={pending}>{pending ? "Logging..." : "Log incident"}</GradientButton>
        </div>
      </form>
      {message ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
    </>
  );
}
