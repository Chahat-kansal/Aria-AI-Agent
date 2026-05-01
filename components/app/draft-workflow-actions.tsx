"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/form-field";
import { GradientButton } from "@/components/ui/gradient-button";
import { SubtleButton } from "@/components/ui/subtle-button";

export function DraftWorkflowActions({
  matterId,
  draftId,
  canEditMatter,
  canUseAi,
  canRunCrossCheck
}: {
  matterId: string;
  draftId: string;
  canEditMatter: boolean;
  canUseAi: boolean;
  canRunCrossCheck: boolean;
}) {
  const router = useRouter();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    const res = await fetch("/api/documents", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    setMessage(data.message ?? data.error);
    startTransition(() => router.refresh());
  }

  async function runMapping() {
    setMessage(null);
    const res = await fetch("/api/application-drafts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matterId })
    });
    const data = await res.json();
    setMessage(data.message ?? data.error);
    startTransition(() => router.refresh());
  }

  async function runFinalCrossCheck() {
    setMessage(null);
    const res = await fetch("/api/application-drafts/final-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matterId })
    });
    const data = await res.json();
    setMessage(data.summary ?? data.error);
    startTransition(() => router.refresh());
  }

  async function sendReview() {
    setMessage(null);
    const res = await fetch("/api/review-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matterId, draftId, recipientEmail, message: "Please review and confirm this AI-assisted draft. Migration agent review remains required." })
    });
    const data = await res.json();
    setMessage(data.message ?? data.error);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {canEditMatter ? <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-white">Upload client document</p>
        <p className="mt-1 text-xs text-slate-400">Stores the file, records metadata in Postgres, classifies evidence, and maps supported values to the draft.</p>
        <form onSubmit={uploadDocument} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="matterId" value={matterId} />
          <FormField label="Upload file">
            <input
              name="file"
              required
              type="file"
              className="block w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-white/15"
            />
          </FormField>
          <GradientButton type="submit" disabled={pending} className="w-full">Upload</GradientButton>
        </form>
      </div> : <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">You do not have permission to upload or edit matter documents.</p>}
      {canUseAi ? <GradientButton onClick={runMapping} disabled={pending} className="w-full">Run AI-assisted draft mapping</GradientButton> : null}
      {canRunCrossCheck ? <SubtleButton onClick={runFinalCrossCheck} disabled={pending} className="w-full">Final submission-readiness cross-check</SubtleButton> : null}
      {canEditMatter ? <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-white">Client review/signature foundation</p>
        <FormField label="Recipient email" className="mt-3">
          <input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="client@example.com" className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15" />
        </FormField>
        <GradientButton onClick={sendReview} disabled={pending} className="mt-3 w-full">Send to client review</GradientButton>
      </div> : null}
      {message ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">{message}</p> : null}
    </div>
  );
}

export function DraftFieldReviewControls({ draftFieldId }: { draftFieldId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function setStatus(status: string) {
    await fetch("/api/draft-fields/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftFieldId, status })
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1">
      <button disabled={pending} onClick={() => setStatus("VERIFIED")} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300 transition hover:bg-emerald-400/15">Verify</button>
      <button disabled={pending} onClick={() => setStatus("NEEDS_REVIEW")} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-300 transition hover:bg-amber-400/15">Needs review</button>
      <button disabled={pending} onClick={() => setStatus("CONFLICTING")} className="rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-xs text-red-300 transition hover:bg-red-400/15">Conflict</button>
    </div>
  );
}
