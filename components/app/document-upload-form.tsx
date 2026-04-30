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
    <form onSubmit={handleSubmit} className="space-y-4">
      <select name="matterId" defaultValue={defaultMatterId ?? matters[0]?.id} required>
        {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
      </select>
      <input name="file" required type="file" />
      <button disabled={isUploading || !matters.length} className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95 disabled:opacity-60">
        {isUploading ? "Uploading..." : "Upload document"}
      </button>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </form>
  );
}
