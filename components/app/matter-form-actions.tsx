"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { SubtleButton } from "@/components/ui/subtle-button";

export function MatterFormActions({
  templateId,
  matterId,
  draftId,
  canEdit
}: {
  templateId: string;
  matterId: string;
  draftId?: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function call(action: "generate" | "approve" | "publish") {
    setMessage(null);
    const response = await fetch(`/api/forms/${templateId}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matterId, draftId, action })
    });
    const payload = await response.json().catch(() => null) as { error?: string; reason?: string; ok?: boolean; hardBlockers?: Array<{ title?: string }> } | null;
    if (!response.ok) {
      const blockerLabel = payload?.hardBlockers?.[0]?.title;
      setMessage(
        blockerLabel
          ? `${payload?.error ?? "Unable to run the form workflow action."} First blocker: ${blockerLabel}.`
          : payload?.error ?? payload?.reason ?? "Unable to run the form workflow action."
      );
      return;
    }
    setMessage(
      action === "generate"
        ? "Form draft generated. Registered migration agent review required before use."
        : action === "approve"
          ? "Form draft approved for client record/review. This system does not lodge applications."
          : "Approved form marked as published to the client portal scope."
    );
    startTransition(() => router.refresh());
  }

  if (!canEdit) {
    return <SubtleButton type="button" disabled className="cursor-not-allowed opacity-70">Form actions unavailable</SubtleButton>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <GradientButton type="button" onClick={() => call("generate")} disabled={isPending}>Generate draft PDF</GradientButton>
      <SubtleButton type="button" onClick={() => call("approve")} disabled={isPending || !draftId}>Approve reviewed copy</SubtleButton>
      <SubtleButton type="button" onClick={() => call("publish")} disabled={isPending || !draftId}>Publish to client portal</SubtleButton>
      {message ? <p className="basis-full text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
