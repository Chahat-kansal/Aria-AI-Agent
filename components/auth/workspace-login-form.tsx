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
      {accepted ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">Account activated. Sign in to continue.</p> : null}
      <input name="email" required className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Work email" type="email" />
      <input name="password" required className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Password" type="password" />
      {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p> : null}
      <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95 disabled:opacity-60" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in to workspace"}
      </button>
    </form>
  );
}
