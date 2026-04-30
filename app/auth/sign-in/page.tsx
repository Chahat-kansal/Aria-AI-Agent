"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Email or password is incorrect.");
      return;
    }

    router.push("/app/overview");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_32%),linear-gradient(135deg,#08111F,#0D1B2E_45%,#111827)] p-6">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-slate-950/65 p-8 shadow-glass backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Owner sign in</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Welcome back</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Company owners can sign in here. Staff should use their company workspace portal link.</p>
        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <input name="email" required className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Email" type="email" />
          <input name="password" required className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Password" type="password" />
          {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          Starting a company workspace? <Link href="/auth/sign-up" className="text-cyan-300 hover:text-cyan-200">Create owner account</Link>
        </p>
      </div>
    </div>
  );
}
