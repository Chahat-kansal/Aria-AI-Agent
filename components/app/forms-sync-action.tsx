"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { SubtleButton } from "@/components/ui/subtle-button";

export function FormsSyncAction({ canSync }: { canSync: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSync() {
    setMessage(null);
    const response = await fetch("/api/forms/sync", { method: "POST" });
    const payload = await response.json().catch(() => null) as {
      error?: string;
      message?: string;
      checked?: number;
      downloaded?: number;
      updated?: number;
      unchanged?: number;
      failed?: number;
      fillable?: number;
      manualOnly?: number;
      onlineOnly?: number;
    } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to sync official forms right now.");
      return;
    }
    setMessage(
      payload?.message
        ? `${payload.message} Checked ${payload.checked}, downloaded ${payload.downloaded}, updated ${payload.updated}, unchanged ${payload.unchanged}, failed ${payload.failed}.`
        : "Official form sync completed."
    );
    startTransition(() => router.refresh());
  }

  if (!canSync) {
    return <SubtleButton type="button" disabled className="cursor-not-allowed opacity-70">Sync official forms</SubtleButton>;
  }

  return (
    <div className="space-y-2">
      <GradientButton type="button" onClick={handleSync} disabled={isPending}>
        {isPending ? "Syncing official forms..." : "Sync official forms"}
      </GradientButton>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}

