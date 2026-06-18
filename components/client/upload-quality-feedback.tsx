"use client";

type QualityStatus =
  | "GOOD_QUALITY"
  | "ACCEPTABLE_WITH_REVIEW"
  | "POOR_QUALITY_REUPLOAD_RECOMMENDED"
  | "UNREADABLE_REUPLOAD_REQUIRED";

function toneForStatus(status: QualityStatus) {
  switch (status) {
    case "GOOD_QUALITY":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "ACCEPTABLE_WITH_REVIEW":
      return "border-cyan-200 bg-cyan-50 text-cyan-900";
    case "POOR_QUALITY_REUPLOAD_RECOMMENDED":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-rose-200 bg-rose-50 text-rose-900";
  }
}

function labelForStatus(status: QualityStatus) {
  switch (status) {
    case "GOOD_QUALITY":
      return "GOOD_QUALITY";
    case "ACCEPTABLE_WITH_REVIEW":
      return "ACCEPTABLE_WITH_REVIEW";
    case "POOR_QUALITY_REUPLOAD_RECOMMENDED":
      return "POOR_QUALITY_REUPLOAD_RECOMMENDED";
    default:
      return "UNREADABLE_REUPLOAD_REQUIRED";
  }
}

export function UploadQualityFeedback(props: {
  qualityStatus?: QualityStatus | null;
  reuploadMessage?: string | null;
  ocrConfigured?: boolean;
}) {
  if (!props.qualityStatus) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Your migration team will review the uploaded file.
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border p-4 text-sm ${toneForStatus(props.qualityStatus)}`}>
      <p className="text-xs font-semibold tracking-[0.12em]">{labelForStatus(props.qualityStatus)}</p>
      <p className="mt-2">
        {props.reuploadMessage || "Your migration team will review the uploaded file."}
      </p>
      {!props.ocrConfigured ? (
        <p className="mt-2 text-xs">
          Your migration team will review the uploaded file.
        </p>
      ) : null}
    </div>
  );
}
