"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/form-field";
import { GradientButton } from "@/components/ui/gradient-button";

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
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <FormField label="Create password">
        <input name="password" required minLength={8} placeholder="Create password" type="password" />
      </FormField>
      <FormField label="Confirm password">
        <input name="confirmPassword" required minLength={8} placeholder="Confirm password" type="password" />
      </FormField>
      {error ? <p className="rounded-[1rem] border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p> : null}
      <GradientButton className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Activating..." : "Activate account"}
      </GradientButton>
    </form>
  );
}
