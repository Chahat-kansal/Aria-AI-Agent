"use client";

export function UploadProgress({ progress, label }: { progress: number; label?: string }) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
        <span>{label || "Uploading"}</span>
        <span>{safeProgress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-[width] duration-300"
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  );
}
