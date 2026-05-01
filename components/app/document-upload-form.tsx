"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { GradientButton } from "@/components/ui/gradient-button";

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
      <FormField label="Matter">
        <select
          name="matterId"
          defaultValue={defaultMatterId ?? matters[0]?.id}
          required
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        >
          {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
        </select>
      </FormField>
      <FormField label="Evidence file" hint="Files remain secure inside the workspace vault.">
        <input
          name="file"
          required
          type="file"
          className="block w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-white/15"
        />
      </FormField>
      <GradientButton type="submit" disabled={isUploading || !matters.length} className="w-full">
        {isUploading ? "Uploading..." : "Upload document"}
      </GradientButton>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </form>
  );
}
