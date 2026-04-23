"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/sign-in" })}
      className="rounded-lg border border-border bg-white/50 px-3 py-2 text-sm text-muted transition hover:bg-white hover:text-[#182033]"
    >
      Sign out
    </button>
  );
}
