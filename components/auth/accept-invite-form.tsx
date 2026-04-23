"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInviteForm({ token, workspaceSlug }: { token: string; workspaceSlug: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setIsSubmitting(false);

    if (!response.ok) {
      setError(result?.error ?? "Unable to accept invite.");
      return;
    }

    router.push(`/w/${workspaceSlug}/login?accepted=1` as any);
  }

  return (
    <form className="mt-5 space-y-3" onSubmit={submit}>
      <input name="password" required minLength={8} type="password" className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Create password" />
      <input name="confirmPassword" required minLength={8} type="password" className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Confirm password" />
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSubmitting}>
        {isSubmitting ? "Activating..." : "Activate account"}
      </button>
    </form>
  );
}
