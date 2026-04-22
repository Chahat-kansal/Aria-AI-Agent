"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/sign-in" })}
      className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:bg-[#111a2b] hover:text-white"
    >
      Sign out
    </button>
  );
}
