"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";

export function MatterOfficialFormsBatchAction({ matterId, canEdit }: { matterId: string; canEdit: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function prepareAll() {
    setMessage(null);
    const response = await fetch(`/api/matters/${matterId}/official-form-drafts`, { method: "POST" });
    const payload = await response.json().catch(() => null) as { error?: string; message?: string; results?: Array<{ pdfGenerated?: boolean; reviewPackGenerated?: boolean }> } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to prepare official form drafts.");
      return;
    }
    const pdfCount = payload?.results?.filter((item) => item.pdfGenerated).length ?? 0;
    const packCount = payload?.results?.filter((item) => item.reviewPackGenerated).length ?? 0;
    setMessage(`${payload?.message ?? "Official form drafts prepared."} PDF drafts: ${pdfCount}. Review field packs: ${packCount}.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <GradientButton type="button" onClick={prepareAll} disabled={!canEdit || isPending}>
        {isPending ? "Preparing official forms..." : "Prepare all official form drafts"}
      </GradientButton>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}

