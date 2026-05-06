"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";

export function FirmTemplateUploadForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsUploading(true);
    const response = await fetch("/api/forms/upload-firm-template", {
      method: "POST",
      body: new FormData(event.currentTarget)
    });
    const payload = await response.json().catch(() => null) as { error?: string; templateId?: string; fillable?: boolean; fieldCount?: number } | null;
    setIsUploading(false);
    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to upload firm template.");
      return;
    }
    setMessage(`Firm template stored privately. Fillable: ${payload?.fillable ? "yes" : "no"}. Detected fields: ${payload?.fieldCount ?? 0}.`);
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <input name="formNumber" required placeholder="Form number" className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white" />
      <input name="title" required placeholder="Template title" className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white" />
      <input name="category" placeholder="Category" className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white" />
      <input name="subclassCodes" placeholder="Subclass codes, comma separated" className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white" />
      <input name="file" type="file" required className="block w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-white/15" />
      <GradientButton type="submit" disabled={isUploading || isPending}>
        {isUploading ? "Uploading firm template..." : "Upload firm template"}
      </GradientButton>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </form>
  );
}

