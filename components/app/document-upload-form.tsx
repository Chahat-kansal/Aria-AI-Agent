"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type MatterOption = {
  id: string;
  label: string;
};

export function DocumentUploadForm({ matters, defaultMatterId }: { matters: MatterOption[]; defaultMatterId?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsUploading(true);
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/documents", {
      method: "POST",
      body: formData
    });
    const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    setIsUploading(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "Upload failed.");
      return;
    }

    setMessage(payload?.message ?? "Document uploaded.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <select name="matterId" defaultValue={defaultMatterId ?? matters[0]?.id} required className="w-full rounded-lg border border-border bg-white/70 p-2 text-sm">
        {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
      </select>
      <input name="file" required type="file" className="w-full rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <button disabled={isUploading || !matters.length} className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {isUploading ? "Uploading..." : "Upload document"}
      </button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </form>
  );
}
