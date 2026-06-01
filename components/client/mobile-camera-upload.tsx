"use client";

type MobileCameraUploadProps = {
  onChoose: () => void;
  disabled?: boolean;
  label?: string;
};

export function MobileCameraUpload({ onChoose, disabled, label = "Take photo" }: MobileCameraUploadProps) {
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      className="inline-flex h-11 min-w-[8.5rem] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}
