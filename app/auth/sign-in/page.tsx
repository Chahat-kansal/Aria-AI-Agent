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
  const [workspacePortal, setWorkspacePortal] = useState<string | null>(null);

  function parseSignInError(message: string | undefined) {
    if (!message) return { text: "Unable to sign in right now.", workspaceSlug: null as string | null };
    if (message.startsWith("WORKSPACE_PORTAL_REQUIRED:")) {
      const workspaceSlug = message.split(":")[1] ?? null;
      return {
        text: "Staff and agents sign in through their firm workspace portal, not the public owner portal.",
        workspaceSlug
      };
    }
    if (message.startsWith("INVITE_NOT_ACCEPTED:")) {
      const workspaceSlug = message.split(":")[1] ?? null;
      return {
        text: "Your staff invite has not been accepted yet. Open the invite link, set your password, and then sign in through the workspace portal.",
        workspaceSlug
      };
    }
    if (message === "USER_DEACTIVATED") {
      return { text: "Your account has been deactivated. Ask your workspace administrator for access.", workspaceSlug: null };
    }
    if (message.startsWith("PASSWORD_NOT_SET:")) {
      const workspaceSlug = message.split(":")[1] ?? null;
      return { text: "Your account setup is incomplete. Finish activation from the invite link and then sign in through your workspace portal.", workspaceSlug };
    }
    return { text: "Email or password is incorrect.", workspaceSlug: null };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWorkspacePortal(null);
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
      const parsed = parseSignInError(result.error);
      setError(parsed.text);
      setWorkspacePortal(parsed.workspaceSlug);
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
        <p className="mt-3 text-base leading-7 text-slate-400">Company owners create and manage workspaces here. Staff and agents sign in through their firm workspace portal, and clients use secure links sent by their migration agent.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <FormField label="Email">
            <input name="email" required placeholder="you@company.com" type="email" />
          </FormField>
          <FormField label="Password">
            <input name="password" required placeholder="Enter your password" type="password" />
          </FormField>
          {error ? <p className="rounded-[1rem] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          {workspacePortal ? (
            <Link
              href={`/w/${workspacePortal}/login` as any}
              className="inline-flex rounded-[1rem] border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200 transition hover:bg-cyan-400/15"
            >
              Go to your workspace portal
            </Link>
          ) : null}
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
