"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Shield, Sparkles, FileCheck2, Files, FolderOutput, FormInput, Send, EyeOff, Eye } from "lucide-react";
import { GradientButton } from "@/components/ui/gradient-button";
import { SubtleButton } from "@/components/ui/subtle-button";

export function ExtractionActionBar({
  matterId,
  draftHref,
  generatedDocumentsHref,
  formsHref,
  portalHref,
  exportHref,
  canRunAiDraftAutofill,
  canRunCrossCheck,
  aiConfigured,
  onPrivacyToggle,
  privacyMode
}: {
  matterId: string;
  draftHref: string;
  generatedDocumentsHref: string;
  formsHref: string;
  portalHref: string;
  exportHref: string;
  canRunAiDraftAutofill: boolean;
  canRunCrossCheck: boolean;
  aiConfigured: boolean;
  onPrivacyToggle: () => void;
  privacyMode: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function runDraftAutofill() {
    setMessage(null);
    const response = await fetch("/api/application-drafts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matterId })
    });
    const payload = await response.json().catch(() => null) as { message?: string; grounded?: { answer?: string }; error?: string } | null;
    setMessage(payload?.grounded?.answer ?? payload?.message ?? payload?.error ?? "Draft autofill completed. Review required.");
    startTransition(() => {
      window.location.reload();
    });
  }

  async function runFinalCrossCheck() {
    setMessage(null);
    const response = await fetch("/api/application-drafts/final-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matterId })
    });
    const payload = await response.json().catch(() => null) as { summary?: string; error?: string } | null;
    setMessage(payload?.summary ?? payload?.error ?? "Cross-check finished. Review required.");
  }

  return (
    <div className="sticky bottom-4 z-20 rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,11,18,0.96),rgba(10,14,22,0.94))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Matter review actions</p>
          <p className="mt-1 text-sm text-slate-400">Every action below is routed through a real Aria page or API. Review required before client-facing use.</p>
        </div>
        <button
          type="button"
          onClick={onPrivacyToggle}
          className="inline-flex h-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-100 transition hover:bg-white/[0.08]"
        >
          {privacyMode ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
          Privacy mode {privacyMode ? "on" : "off"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          title="Approval workflow is not configured yet. Use the draft review workspace to verify field-level evidence."
          className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-500"
        >
          <Shield className="mr-2 h-4 w-4" />
          Approve extracted data
        </button>
        <Link href={draftHref as any}><SubtleButton className="h-10 px-4"><FormInput className="mr-2 h-4 w-4" />Edit fields</SubtleButton></Link>
        <GradientButton
          onClick={runDraftAutofill}
          disabled={pending || !canRunAiDraftAutofill || !aiConfigured}
          className="h-10 px-4"
          title={!aiConfigured ? "AI is not configured. Add OPENAI_API_KEY to enable draft autofill." : undefined}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Run AI Draft Autofill
        </GradientButton>
        <Link href={draftHref as any}><SubtleButton className="h-10 px-4"><FileCheck2 className="mr-2 h-4 w-4" />Review application draft</SubtleButton></Link>
        <Link href={generatedDocumentsHref as any}><SubtleButton className="h-10 px-4"><Files className="mr-2 h-4 w-4" />Generate draft pack</SubtleButton></Link>
        <Link href={formsHref as any}><SubtleButton className="h-10 px-4">Open official forms</SubtleButton></Link>
        <Link href={portalHref as any}><SubtleButton className="h-10 px-4"><Send className="mr-2 h-4 w-4" />Send to client portal</SubtleButton></Link>
        <a href={exportHref}><SubtleButton className="h-10 px-4"><FolderOutput className="mr-2 h-4 w-4" />Export secure client folder</SubtleButton></a>
        <button
          type="button"
          onClick={runFinalCrossCheck}
          disabled={pending || !canRunCrossCheck}
          className="inline-flex h-10 items-center justify-center rounded-[1rem] border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Final cross-check
        </button>
      </div>

      {message ? <p className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-slate-200">{message}</p> : null}
      {!aiConfigured ? <p className="mt-3 text-xs text-amber-300">AI is not configured. Add OPENAI_API_KEY to enable draft autofill.</p> : null}
    </div>
  );
}
