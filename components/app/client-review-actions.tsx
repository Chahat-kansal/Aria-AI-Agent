"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ClientReviewActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function setStatus(status: string) {
    await fetch(`/api/review-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <button disabled={pending} onClick={() => setStatus("SIGNED_CONFIRMED")} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Confirm details</button>
      <button disabled={pending} onClick={() => setStatus("RETURNED_TO_AGENT")} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-60">Return to agent</button>
      <button disabled={pending} onClick={() => setStatus("REQUIRES_FOLLOW_UP")} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-60">Needs follow-up</button>
    </div>
  );
}
