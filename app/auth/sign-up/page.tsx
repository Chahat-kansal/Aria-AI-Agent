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
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-muted">Set up your migration company workspace. The first account becomes the Company Owner.</p>
        <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
          <input name="name" required className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Owner full name" />
          <input name="email" required className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Owner work email" type="email" />
          <input name="workspaceName" required className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Company / business name" />
          <input name="contactEmail" className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Company contact email" type="email" />
          <input name="contactPhone" className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Company phone" />
          <input name="timezone" className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Timezone, e.g. Australia/Sydney" />
          <input name="businessType" className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Business type, e.g. Migration firm" />
          <input name="addressLine1" className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Business address" />
          <input name="password" required minLength={8} className="w-full rounded-lg border border-border bg-white/70 p-2 sm:col-span-2" placeholder="Password" type="password" />
          {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          <button
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating workspace..." : "Create workspace"}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted">
          Already have an account? <Link href="/auth/sign-in" className="text-accent">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
