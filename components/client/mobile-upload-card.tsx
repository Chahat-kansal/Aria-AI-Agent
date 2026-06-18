"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MobileCameraUpload } from "@/components/client/mobile-camera-upload";
import { MobileUploadErrorState } from "@/components/client/mobile-upload-error-state";
import { UploadProgress } from "@/components/client/upload-progress";
import { UploadQualityFeedback } from "@/components/client/upload-quality-feedback";

type UploadQualityStatus =
  | "GOOD_QUALITY"
  | "ACCEPTABLE_WITH_REVIEW"
  | "POOR_QUALITY_REUPLOAD_RECOMMENDED"
  | "UNREADABLE_REUPLOAD_REQUIRED";

type UploadSuccessPayload = {
  document: {
    fileName: string;
    createdAt: string;
    qualityStatus: UploadQualityStatus | null;
    qualityScore: number | null;
    reuploadMessage: string | null;
  };
  checklist: {
    itemId: string;
    statusLabel: string;
    waitingForTeamReview: boolean;
    teamNote: string;
    uploadedAtLabel: string;
  };
  notification: {
    created: boolean;
  };
  extraction: {
    configured: boolean;
    qualityStatus: UploadQualityStatus | null;
    reviewMessage: string;
  };
};

type MobileUploadCardProps = {
  checklistItemId: string;
  label: string;
  token?: string | null;
  acceptedFormatsLabel: string;
  maxSizeMb: number;
  acceptedMimeTypes: string[];
  allowReupload?: boolean;
  existingFileName?: string | null;
  existingUploadLabel?: string | null;
  existingTeamNote?: string | null;
  teamNote?: string | null;
  onUploaded?: (result: UploadSuccessPayload) => void;
};

function prettyBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function supportsCameraCapture() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ios/i.test(navigator.userAgent || "");
}

function supportsWebpBrowser() {
  if (typeof document === "undefined") return true;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

export function MobileUploadCard(props: MobileUploadCardProps) {
  const chooseInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [success, setSuccess] = useState<UploadSuccessPayload | null>(null);

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const captureAvailable = useMemo(() => supportsCameraCapture(), []);
  const acceptedMimeTypes = useMemo(
    () => props.acceptedMimeTypes.filter((type) => type !== "image/webp" || supportsWebpBrowser()),
    [props.acceptedMimeTypes]
  );

  function resetTransientState() {
    setError(null);
    setSuccess(null);
    setProgress(0);
  }

  function handleFileSelection(file: File | null) {
    resetTransientState();
    setSelectedFile(file);
    if (!file) return;
    if (!acceptedMimeTypes.includes(file.type)) {
      setError("This file type is not supported.");
      return;
    }
    if (file.size <= 0) {
      setError("Please choose a file to upload.");
      return;
    }
    if (file.size > props.maxSizeMb * 1024 * 1024) {
      setError("This file is too large.");
    }
  }

  async function uploadSelectedFile() {
    if (offline) {
      setError("You appear to be offline. Please reconnect to upload.");
      return;
    }
    if (!selectedFile) {
      setError("Please choose a file to upload.");
      return;
    }
    if (!acceptedMimeTypes.includes(selectedFile.type)) {
      setError("This file type is not supported.");
      return;
    }
    if (selectedFile.size > props.maxSizeMb * 1024 * 1024) {
      setError("This file is too large.");
      return;
    }

    const formData = new FormData();
    formData.append("checklistItemId", props.checklistItemId);
    formData.append("file", selectedFile);
    if (props.token) formData.append("token", props.token);

    setBusy(true);
    setError(null);
    setProgress(0);

    const result = await new Promise<{ ok: boolean; body: any }>((resolve) => {
      const request = new XMLHttpRequest();
      request.open("POST", "/api/portal/uploads");
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        setProgress(Math.max(8, Math.round((event.loaded / event.total) * 100)));
      };
      request.onload = () => {
        try {
          const body = JSON.parse(request.responseText || "{}");
          resolve({ ok: request.status >= 200 && request.status < 300, body });
        } catch {
          resolve({ ok: false, body: { error: "Upload failed. Please try again." } });
        }
      };
      request.onerror = () => resolve({ ok: false, body: { error: "Upload failed. Please try again." } });
      request.send(formData);
    });

    setBusy(false);
    setProgress(result.ok ? 100 : 0);

    if (!result.ok || !result.body?.ok) {
      setError(result.body?.error || "Upload failed. Please try again.");
      return;
    }

    setSuccess(result.body);
    props.onUploaded?.(result.body);
    setSelectedFile(null);
    if (chooseInputRef.current) chooseInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  return (
    <div className="mt-4 space-y-4 rounded-[1.75rem] border border-violet-100 bg-violet-50/70 p-4 sm:p-5">
      <input
        ref={chooseInputRef}
        type="file"
        accept={acceptedMimeTypes.join(",")}
        className="sr-only"
        onChange={(event) => handleFileSelection(event.currentTarget.files?.[0] ?? null)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => handleFileSelection(event.currentTarget.files?.[0] ?? null)}
      />

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-950">
          {props.allowReupload ? "Re-upload this document" : `Upload ${props.label}`}
        </p>
        <p className="text-sm leading-6 text-slate-700">
          Take a clear photo or upload a scan. Make sure all corners are visible. Make sure the text is sharp and
          readable. Avoid glare or shadows. Upload one document at a time. Do not crop out any part of the document.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MobileCameraUpload
          onChoose={() => cameraInputRef.current?.click()}
          disabled={busy || !captureAvailable}
          label={captureAvailable ? "Take photo" : "Take photo unavailable"}
        />
        <button
          type="button"
          onClick={() => chooseInputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Choose file
        </button>
      </div>

      <div className="rounded-3xl border border-white/80 bg-white p-4 text-xs leading-6 text-slate-600">
        <p>
          <span className="font-semibold text-slate-950">Accepted formats:</span> {props.acceptedFormatsLabel}
        </p>
        <p>
          <span className="font-semibold text-slate-950">Max size:</span> {props.maxSizeMb} MB
        </p>
        <p>
          <span className="font-semibold text-slate-950">Review note:</span>{" "}
          {props.teamNote || "Your migration team will review this before use."}
        </p>
      </div>

      {selectedFile ? (
        <div className="rounded-3xl border border-white/80 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Selected file</p>
          <p className="mt-2 break-words text-sm font-semibold text-slate-950">{selectedFile.name}</p>
          <p className="mt-1 text-xs text-slate-600">{prettyBytes(selectedFile.size)}</p>
        </div>
      ) : props.existingFileName ? (
        <div className="rounded-3xl border border-white/80 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current upload</p>
          <p className="mt-2 break-words text-sm font-semibold text-slate-950">{props.existingFileName}</p>
          {props.existingUploadLabel ? <p className="mt-1 text-xs text-slate-600">{props.existingUploadLabel}</p> : null}
          {props.existingTeamNote ? <p className="mt-2 text-xs text-slate-600">{props.existingTeamNote}</p> : null}
        </div>
      ) : null}

      {offline ? <MobileUploadErrorState message="You appear to be offline. Please reconnect to upload." /> : null}
      {error ? <MobileUploadErrorState message={error} /> : null}
      {busy ? <UploadProgress progress={progress} label="Uploading document" /> : null}
      {success ? (
        <div className="space-y-3">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Uploaded - waiting for team review. {success.checklist.teamNote}
          </div>
          <UploadQualityFeedback
            qualityStatus={success.extraction.qualityStatus}
            reuploadMessage={success.document.reuploadMessage}
            ocrConfigured={success.extraction.configured}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={uploadSelectedFile}
          disabled={busy || offline || !selectedFile || Boolean(error)}
          className="inline-flex h-11 min-w-[8.5rem] items-center justify-center rounded-2xl bg-violet-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Uploading..." : props.allowReupload ? "Re-upload" : "Upload"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedFile(null);
            resetTransientState();
            if (chooseInputRef.current) chooseInputRef.current.value = "";
            if (cameraInputRef.current) cameraInputRef.current.value = "";
          }}
          disabled={busy}
          className="inline-flex h-11 min-w-[8.5rem] items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
