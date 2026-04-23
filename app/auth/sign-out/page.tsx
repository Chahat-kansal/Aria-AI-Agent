"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export default function SignOutPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you out...");

  useEffect(() => {
    let active = true;

    async function runSignOut() {
      try {
        await signOut({ redirect: false, callbackUrl: "/auth/sign-in" });
        if (!active) return;
        setMessage("Signed out. Redirecting...");
        router.replace("/auth/sign-in");
        router.refresh();
      } catch {
        if (!active) return;
        setMessage("Could not complete the client sign out. Opening the secure sign-out endpoint...");
        window.location.href = "/api/auth/signout?callbackUrl=/auth/sign-in";
      }
    }

    runSignOut();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-md p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria Migration SaaS</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign out</h1>
        <p className="mt-3 text-sm text-muted">{message}</p>
        <Link href="/auth/sign-in" className="mt-5 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          Return to sign in
        </Link>
      </div>
    </div>
  );
}

