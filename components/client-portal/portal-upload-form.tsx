"use client";

import { useRef, useState, type FormEvent } from "react";

type Props = {
  checklistItemId: string;
  uploadAction: (formData: FormData) => void | Promise<void>;
  buttonLabel?: string;
};

export function PortalUploadForm({ checklistItemId, uploadAction, buttonLabel = "Upload document" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      event.preventDefault();
      setError("Choose a document before uploading.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
  }

  return (
    <form action={uploadAction} onSubmit={handleSubmit} className="mt-4 space-y-3">
      <input type="hidden" name="checklistItemId" value={checklistItemId} />
      <label className="block rounded-3xl border border-dashed border-cyan-200/35 bg-cyan-200/[0.06] p-4 transition hover:bg-cyan-200/[0.10]">
        <input
          ref={inputRef}
          required
          type="file"
          name="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            setFileName(event.currentTarget.files?.[0]?.name ?? null);
            setError(null);
          }}
        />
        <span className="block text-sm font-semibold text-white">{fileName ?? "Choose a clear scan or photo"}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-300">
          PDF, JPG, PNG, or WEBP. Upload a clear scan or photo. Make sure all corners are visible and there is no glare.
        </span>
        <span className="mt-3 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm">
          Choose file
        </span>
      </label>
      <label className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-xs leading-5 text-slate-300">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        <span>I understand my migration team will review this before it is used. Aria does not lodge applications or guarantee visa outcomes.</span>
      </label>
      {error ? <p className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Uploading..." : buttonLabel}
      </button>
    </form>
  );
}

