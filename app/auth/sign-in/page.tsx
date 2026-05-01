"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { AppPage } from "@/components/ui/app-page";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { GradientButton } from "@/components/ui/gradient-button";
import { SubtleButton } from "@/components/ui/subtle-button";

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
    <AppPage contentClassName="flex min-h-screen items-center justify-center py-10">
      <Card className="w-full max-w-md p-8 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300">Aria</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">Welcome back.</h1>
        <p className="mt-3 text-base leading-7 text-slate-400">Sign in to continue. Company owners use this page, while staff sign in through their workspace portal.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <FormField label="Email">
            <input name="email" required placeholder="you@company.com" type="email" />
          </FormField>
          <FormField label="Password">
            <input name="password" required placeholder="Enter your password" type="password" />
          </FormField>
          {error ? <p className="rounded-[1rem] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          <GradientButton className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </GradientButton>
        </form>

        <div className="mt-4 flex flex-col gap-3 text-sm">
          <Link href="/auth/sign-up" className="text-cyan-300 hover:text-cyan-200">New here? Create an owner account</Link>
          <Link href="/" className="text-slate-500 hover:text-slate-300">Back to product overview</Link>
        </div>
      </Card>
    </AppPage>
  );
}
