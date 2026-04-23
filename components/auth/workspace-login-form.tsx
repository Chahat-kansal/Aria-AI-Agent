"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function WorkspaceLoginForm({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accepted = searchParams.get("accepted") === "1";
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      workspaceSlug,
      redirect: false
    });

    setIsSubmitting(false);
    if (result?.error) {
      setError("Email or password is incorrect for this workspace.");
      return;
    }

    router.push("/app/overview");
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-3" onSubmit={submit}>
      {accepted ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Account activated. Sign in to continue.</p> : null}
      <input name="email" required className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Work email" type="email" />
      <input name="password" required className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Password" type="password" />
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in to workspace"}
      </button>
    </form>
  );
}
