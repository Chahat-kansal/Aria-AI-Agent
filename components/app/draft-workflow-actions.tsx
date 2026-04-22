"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DraftWorkflowActions({ matterId, draftId }: { matterId: string; draftId: string }) {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function uploadDocument() {
    if (!fileName.trim()) return;
    setMessage(null);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matterId, fileName: fileName.trim(), mimeType: fileName.endsWith(".pdf") ? "application/pdf" : "application/octet-stream" })
    });
    const data = await res.json();
    setMessage(data.message ?? data.error);
    setFileName("");
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
      <div className="rounded-xl border border-border bg-[#0e182a] p-3">
        <p className="text-sm font-semibold">Upload client document</p>
        <p className="mt-1 text-xs text-muted">Records metadata in Postgres, classifies the file, stores extraction output, and maps supported values to the draft.</p>
        <div className="mt-3 flex gap-2">
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="passport-client.pdf" className="w-full rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
          <button onClick={uploadDocument} disabled={pending} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">Upload</button>
        </div>
      </div>
      <button onClick={runMapping} disabled={pending} className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">Run AI-assisted draft mapping</button>
      <div className="rounded-xl border border-border bg-[#0e182a] p-3">
        <p className="text-sm font-semibold">Client review/signature foundation</p>
        <input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="client@example.com" className="mt-2 w-full rounded-lg border border-border bg-[#0d1728] p-2 text-sm" />
        <button onClick={sendReview} disabled={pending} className="mt-2 w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">Send to client review</button>
      </div>
      {message ? <p className="rounded-lg border border-border bg-[#0e182a] p-2 text-xs text-muted">{message}</p> : null}
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
      <button disabled={pending} onClick={() => setStatus("VERIFIED")} className="rounded border border-border px-2 py-1 text-xs">Verify</button>
      <button disabled={pending} onClick={() => setStatus("NEEDS_REVIEW")} className="rounded border border-border px-2 py-1 text-xs">Needs review</button>
      <button disabled={pending} onClick={() => setStatus("CONFLICTING")} className="rounded border border-border px-2 py-1 text-xs">Conflict</button>
    </div>
  );
}
