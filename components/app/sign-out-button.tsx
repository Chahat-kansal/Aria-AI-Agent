"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut({ redirect: false, callbackUrl: "/auth/sign-in" });
      router.push("/auth/sign-in");
      router.refresh();
    } catch {
      window.location.href = "/api/auth/signout?callbackUrl=/auth/sign-in";
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="rounded-lg border border-border bg-white/50 px-3 py-2 text-sm text-muted transition hover:bg-white hover:text-[#182033]"
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
