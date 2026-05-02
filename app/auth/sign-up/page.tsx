"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { AppPage } from "@/components/ui/app-page";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { GradientButton } from "@/components/ui/gradient-button";

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
    <AppPage contentClassName="flex min-h-screen items-center justify-center py-10">
      <Card className="w-full max-w-3xl p-8 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300">Company onboarding</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">Create your workspace.</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">Company owners create and manage workspaces here. The first user becomes the Company Owner and can invite staff later.</p>

        <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <FormField label="Owner full name">
            <input name="name" required placeholder="Full name" />
          </FormField>
          <FormField label="Owner work email">
            <input name="email" required placeholder="you@company.com" type="email" />
          </FormField>
          <FormField label="Company / business name">
            <input name="workspaceName" required placeholder="Workspace name" />
          </FormField>
          <FormField label="Company contact email">
            <input name="contactEmail" placeholder="billing@company.com" type="email" />
          </FormField>
          <FormField label="Company phone">
            <input name="contactPhone" placeholder="+61 ..." />
          </FormField>
          <FormField label="Timezone">
            <input name="timezone" placeholder="Australia/Sydney" />
          </FormField>
          <FormField label="Business type">
            <input name="businessType" placeholder="Migration firm" />
          </FormField>
          <FormField label="Business address">
            <input name="addressLine1" placeholder="Street address" />
          </FormField>
          <FormField className="sm:col-span-2" label="Password">
            <input name="password" required minLength={8} placeholder="Create a secure password" type="password" />
          </FormField>
          {error ? <p className="rounded-[1rem] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 sm:col-span-2">{error}</p> : null}
          <GradientButton className="w-full sm:col-span-2" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating workspace..." : "Create workspace"}
          </GradientButton>
        </form>

        <p className="mt-5 text-sm text-slate-400">
          Already have an account? <Link href="/auth/sign-in" className="text-cyan-300 hover:text-cyan-200">Sign in</Link>
        </p>
      </Card>
    </AppPage>
  );
}
