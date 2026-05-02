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

  function getWorkspaceErrorMessage(message: string | undefined) {
    if (!message) return "Unable to sign in to this workspace right now.";
    if (message.startsWith("INVITE_NOT_ACCEPTED")) return "Invite not accepted yet. Open your invite link first, set your password, and then sign in here.";
    if (message.startsWith("PASSWORD_NOT_SET")) return "Your account is not active yet. Finish account setup from your invite link before signing in.";
    if (message.startsWith("WRONG_WORKSPACE")) return "This email belongs to a different workspace. Use your own firm workspace portal to sign in.";
    if (message === "USER_DEACTIVATED") return "Your account has been deactivated. Ask your workspace administrator for help.";
    if (message === "INVALID_CREDENTIALS") return "Email or password is incorrect for this workspace.";
    return "Unable to sign in to this workspace right now.";
  }

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
      setError(getWorkspaceErrorMessage(result.error));
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
      <p className="text-xs text-slate-500">Staff and agents sign in through your firm workspace portal. Company owners create and manage workspaces through the public owner portal.</p>
    </form>
  );
}
