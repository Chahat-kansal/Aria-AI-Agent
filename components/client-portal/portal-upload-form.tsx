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
      setError("Choose a file first.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
  }

  return (
    <form action={uploadAction} onSubmit={handleSubmit} className="mt-4 space-y-3">
      <input type="hidden" name="checklistItemId" value={checklistItemId} />
      <label className="block cursor-pointer rounded-3xl border border-dashed border-violet-300 bg-violet-50 p-4 transition hover:bg-violet-100/70">
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
        <span className="block text-sm font-semibold text-slate-950">{fileName ?? "Choose file"}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">
          PDF, JPG, PNG, WEBP. Max size follows your firm&apos;s upload settings.
        </span>
        <span className="mt-3 block text-sm leading-6 text-slate-700">
          Upload a clear scan or photo. Make sure all corners are visible, text is sharp, and there is no glare.
        </span>
        <span className="mt-3 inline-flex rounded-2xl bg-violet-700 px-4 py-2 text-sm font-semibold text-[#fff] shadow-sm">
          Browse files
        </span>
      </label>
      <label className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        <span>Your migration team will review this before use.</span>
      </label>
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-violet-700 px-5 text-sm font-semibold text-[#fff] shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Uploading..." : buttonLabel}
      </button>
    </form>
  );
}
