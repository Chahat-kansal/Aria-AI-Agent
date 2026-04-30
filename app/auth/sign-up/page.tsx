"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const workspaceName = String(formData.get("workspaceName") ?? "");
    const contactEmail = String(formData.get("contactEmail") ?? "");
    const contactPhone = String(formData.get("contactPhone") ?? "");
    const timezone = String(formData.get("timezone") ?? "");
    const businessType = String(formData.get("businessType") ?? "");
    const addressLine1 = String(formData.get("addressLine1") ?? "");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, workspaceName, contactEmail, contactPhone, timezone, businessType, addressLine1 })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to create account.");
      setIsSubmitting(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    setIsSubmitting(false);

    if (result?.error) {
      router.push("/auth/sign-in");
      return;
    }

    router.push("/app/overview");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_32%),linear-gradient(135deg,#08111F,#0D1B2E_45%,#111827)] p-6">
      <div className="w-full max-w-2xl rounded-4xl border border-white/10 bg-slate-950/65 p-8 shadow-glass backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Company onboarding</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Create company workspace</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Set up your migration company workspace. The first account becomes the Company Owner.</p>
        <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
          <input name="name" required className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Owner full name" />
          <input name="email" required className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Owner work email" type="email" />
          <input name="workspaceName" required className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Company / business name" />
          <input name="contactEmail" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Company contact email" type="email" />
          <input name="contactPhone" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Company phone" />
          <input name="timezone" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Timezone, e.g. Australia/Sydney" />
          <input name="businessType" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Business type, e.g. Migration firm" />
          <input name="addressLine1" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" placeholder="Business address" />
          <input name="password" required minLength={8} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15 sm:col-span-2" placeholder="Password" type="password" />
          {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating workspace..." : "Create workspace"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          Already have an account? <Link href="/auth/sign-in" className="text-cyan-300 hover:text-cyan-200">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
