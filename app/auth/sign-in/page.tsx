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
    <AppPage contentClassName="flex min-h-full items-center justify-center py-10">
      <Card className="w-full max-w-md p-8 sm:p-10">
        <div className="themed-logo-mark flex h-12 w-12 items-center justify-center rounded-[1rem] text-white">A</div>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--accent)]">Aria Migration</p>
        <h1 className="page-title-display mt-4 text-[3.2rem] leading-none text-[color:var(--text-strong)]">Welcome back.</h1>
        <p className="mt-4 text-base leading-8 text-[color:var(--text-muted)]">Company owners create and manage workspaces here. Staff and agents sign in through their firm workspace portal, and clients use secure links sent by their migration agent.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <FormField label="Email">
            <input name="email" required placeholder="you@company.com" type="email" />
          </FormField>
          <FormField label="Password">
            <input name="password" required placeholder="Enter your password" type="password" />
          </FormField>
          {error ? <p className="rounded-[1rem] border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-500 dark:text-rose-200">{error}</p> : null}
          {workspacePortal ? (
            <Link
              href={`/w/${workspacePortal}/login` as any}
              className="inline-flex rounded-[1rem] bg-[color:var(--info-bg)] px-4 py-3 text-sm text-[color:var(--info)] shadow-[var(--shadow-sm)] transition hover:opacity-90"
            >
              Go to your workspace portal
            </Link>
          ) : null}
          <GradientButton className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </GradientButton>
        </form>

        <div className="mt-4 flex flex-col gap-3 text-sm">
          <Link href="/auth/sign-up" className="text-[color:var(--accent)] hover:opacity-80">New here? Create an owner account</Link>
          <Link href="/" className="text-[color:var(--text-faint)] hover:text-[color:var(--text-muted)]">Back to product overview</Link>
        </div>
      </Card>
    </AppPage>
  );
}
