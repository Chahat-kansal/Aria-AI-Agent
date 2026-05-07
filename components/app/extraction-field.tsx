"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, FileText } from "lucide-react";
import { ExtractionSourceBadge } from "@/components/app/extraction-source-badge";
import type { ExtractionReviewField } from "@/lib/services/extraction-review";
import { cn } from "@/lib/utils";

function maskValue(value: string, kind?: ExtractionReviewField["maskKind"]) {
  if (!kind) return value;

  if (kind === "passport" || kind === "grant" || kind === "policy") {
    if (value.length <= 4) return "****";
    return `${value.slice(0, 2)}${"*".repeat(Math.max(2, value.length - 4))}${value.slice(-2)}`;
  }

  if (kind === "email") {
    const [local, domain] = value.split("@");
    if (!domain) return "****";
    return `${local.slice(0, 1)}****@${domain}`;
  }

  if (kind === "phone") {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 4) return "****";
    return `${value.slice(0, 3)}****${value.slice(-2)}`;
  }

  if (kind === "address") {
    return value.split(",")[0] ? `${value.split(",")[0].slice(0, 6)}****` : "****";
  }

  if (kind === "dob") {
    const parts = value.split(" ");
    if (parts.length >= 3) return `${parts[0]} ${parts[1]} ****`;
    return "****";
  }

  return value;
}

function statusTone(status: ExtractionReviewField["status"]) {
  switch (status) {
    case "verified":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "conflicting":
      return "border-rose-400/25 bg-rose-400/10 text-rose-100";
    case "low_confidence":
      return "border-amber-400/25 bg-amber-400/10 text-amber-100";
    case "agent_edited":
      return "border-violet-400/25 bg-violet-400/10 text-violet-100";
    case "missing":
      return "border-white/10 bg-white/[0.04] text-slate-300";
    default:
      return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  }
}

export function ExtractionField({
  field,
  privacyMode
}: {
  field: ExtractionReviewField;
  privacyMode: boolean;
}) {
  const [showSource, setShowSource] = useState(false);
  const displayValue = useMemo(() => {
    if (!field.value) return "Missing";
    return privacyMode ? maskValue(field.value, field.maskKind) : field.value;
  }, [field.maskKind, field.value, privacyMode]);

  return (
    <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">{field.label}</p>
          <p className={cn("mt-3 text-sm leading-7", field.value ? "text-white" : "text-slate-500")}>{displayValue}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]", statusTone(field.status))}>
            {field.status.replaceAll("_", " ")}
          </span>
          <ExtractionSourceBadge reliability={field.reliability} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Confidence</p>
          <p className="mt-2 text-sm text-slate-200">{field.confidence == null ? "Not scored" : `${Math.round(field.confidence * 100)}%`}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Source document</p>
          <p className="mt-2 text-sm text-slate-200">{field.sourceDocumentName ?? "Source required"}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Location</p>
          <p className="mt-2 text-sm text-slate-200">{field.sourcePageRef ?? "No page reference"}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSource((current) => !current)}
          className="inline-flex h-9 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 transition hover:bg-white/[0.08]"
        >
          {showSource ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {showSource ? "Hide source" : "Show source"}
        </button>
        {field.downloadHref ? (
          <Link href={field.downloadHref as any} className="inline-flex h-9 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 transition hover:bg-white/[0.08]">
            <FileText className="mr-2 h-4 w-4" />
            Secure document
          </Link>
        ) : null}
      </div>

      {showSource ? (
        <div className="mt-4 rounded-[1.1rem] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Source snippet</p>
          <p className="mt-2 text-sm leading-7 text-slate-300">{field.sourceSnippet ?? field.note ?? "Source required"}</p>
        </div>
      ) : null}
    </div>
  );
}
