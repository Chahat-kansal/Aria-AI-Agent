"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormField } from "@/components/ui/form-field";
import { GradientButton } from "@/components/ui/gradient-button";

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
    <form className="mt-8 space-y-4" onSubmit={submit}>
      {accepted ? <p className="rounded-[1rem] border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">Account activated. Sign in to continue.</p> : null}
      <FormField label="Email">
        <input name="email" required placeholder="Work email" type="email" />
      </FormField>
      <FormField label="Password">
        <input name="password" required placeholder="Password" type="password" />
      </FormField>
      {error ? <p className="rounded-[1rem] border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p> : null}
      <GradientButton className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in to workspace"}
      </GradientButton>
    </form>
  );
}
