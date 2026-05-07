"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot, FileSearch } from "lucide-react";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { ExtractionActionBar } from "@/components/app/extraction-action-bar";
import { ExtractionAlert } from "@/components/app/extraction-alert";
import { ExtractionField } from "@/components/app/extraction-field";
import { ExtractionPersonCard } from "@/components/app/extraction-person-card";
import { ExtractionReviewSection } from "@/components/app/extraction-review-section";
import { ExtractionSourceBadge } from "@/components/app/extraction-source-badge";
import { ExtractionStatCard } from "@/components/app/extraction-stat-card";
import type { ExtractionReviewDashboardData } from "@/lib/services/extraction-review";

export function ExtractionReviewDashboard({ data }: { data: ExtractionReviewDashboardData }) {
  const [privacyMode, setPrivacyMode] = useState(true);
  const [activeTab, setActiveTab] = useState(data.people[0]?.tabId ?? data.summary.currentTabId);

  const activePerson = data.people.find((person) => person.tabId === activeTab) ?? data.people[0] ?? null;
  const visibleSections = useMemo(() => {
    return data.sections.filter((section) => section.tabIds.includes(activeTab) || section.tabIds.includes("application"));
  }, [activeTab, data.sections]);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-white/8 bg-[linear-gradient(180deg,rgba(6,9,15,0.95),rgba(7,11,18,0.92))] px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-100">
                <CircleDot className="mr-2 h-3.5 w-3.5" />
                Aria
              </span>
              <StatusPill tone={data.summary.activeFlags ? "warning" : "success"}>{data.summary.reviewStatus}</StatusPill>
              <StatusPill tone="info">{data.summary.visaSubclass}</StatusPill>
              <StatusPill>{data.summary.visaStream}</StatusPill>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">Extraction review dashboard</h1>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
              Evidence-backed extraction review for {data.summary.applicantName}. Use this workspace to inspect source-linked fields, flags, and draft readiness before moving into draft review.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Reference</p>
              <p className="mt-2 text-sm text-white">{data.summary.matterReference}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Location</p>
              <p className="mt-2 text-sm text-white">{data.summary.location ?? "Not known yet"}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last extraction</p>
              <p className="mt-2 text-sm text-white">{data.summary.lastExtractionAt ?? "Not yet run"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
          <ExtractionSourceBadge reliability="AI_EXTRACTED" />
          <ExtractionSourceBadge reliability="CLIENT_SUPPLIED" />
          <ExtractionSourceBadge reliability="AGENT_ENTERED" />
          <ExtractionSourceBadge reliability="SYSTEM_DERIVED" />
          {data.summary.activeFlags ? <ExtractionSourceBadge reliability="OFFICIAL" className="hidden" /> : null}
        </div>
      </div>

      <AIReviewNotice />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ExtractionStatCard label="Draft readiness" value={`${data.summary.draftReadiness}%`} hint="Current matter draft readiness." tone={data.summary.draftReadiness >= 80 ? "good" : data.summary.draftReadiness >= 60 ? "warn" : "danger"} />
        <ExtractionStatCard label="Active flags" value={data.summary.activeFlags} hint="Real extraction and evidence warnings." tone={data.summary.activeFlags ? "warn" : "good"} />
        <ExtractionStatCard label="Uploaded documents" value={data.summary.uploadedDocuments} hint="Matter-linked evidence files." />
        <ExtractionStatCard label="Missing required fields" value={data.summary.missingRequiredFields} hint="Fields still lacking trusted evidence." tone={data.summary.missingRequiredFields ? "warn" : "good"} />
      </div>

      <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(9,13,21,0.95),rgba(12,17,27,0.92))] p-4 shadow-glass">
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2">
          {data.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-w-fit rounded-[1rem] border px-4 py-3 text-left transition ${
                activeTab === tab.id
                  ? "border-cyan-400/30 bg-cyan-400/10 text-white"
                  : "border-white/8 bg-white/[0.03] text-slate-300 hover:bg-white/[0.05]"
              }`}
            >
              <p className="text-sm font-semibold">{tab.label}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">{tab.role}</p>
              <p className="mt-2 text-xs text-slate-400">{tab.status} - {tab.flagCount} flag(s)</p>
            </button>
          ))}
        </div>
      </div>

      {!data.summary.hasExtractedEvidence ? (
        <EmptyState
          title="Upload documents or run extraction to build this review dashboard."
          description="Aria will only render extraction-backed sections here when secure documents have been uploaded and extraction records exist for this matter."
          action={<Link href={data.summary.documentsHref as any} className="inline-flex h-11 items-center justify-center rounded-[1.35rem] bg-gradient-to-r from-violet-500 via-violet-400 to-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_14px_48px_rgba(34,211,238,0.22)] transition hover:scale-[1.01] hover:opacity-95">Upload documents</Link>}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_370px]">
        <div className="space-y-6">
          {activePerson ? (
            <ExtractionReviewSection title="Applicant / case tabs" description="Primary applicant and related applicants extracted or linked to this matter." icon="UserRound">
              <div className="grid gap-3 md:grid-cols-2">
                {data.people.map((person) => (
                  <ExtractionPersonCard key={person.id} person={person} active={person.tabId === activeTab} onSelect={() => setActiveTab(person.tabId)} />
                ))}
              </div>
            </ExtractionReviewSection>
          ) : null}

          {visibleSections.map((section) => (
            <ExtractionReviewSection key={section.id} title={section.title} description={section.description} icon={section.icon}>
              <div className="grid gap-3 lg:grid-cols-2">
                {section.fields.map((field) => <ExtractionField key={field.key} field={field} privacyMode={privacyMode} />)}
              </div>
            </ExtractionReviewSection>
          ))}
        </div>

        <div className="space-y-6">
          <ExtractionReviewSection title="Reference bar" description="Real linked records around draft readiness, evidence, and client activity." icon="FolderKanban">
            <div className="space-y-3">
              <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Draft field review</p>
                  <StatusPill tone={data.draftStats.conflicting ? "danger" : data.draftStats.needsReview ? "warning" : "success"}>
                    {data.draftStats.verified} verified
                  </StatusPill>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-slate-200">Mapped fields: {data.draftStats.mapped}</div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-slate-200">Needs review: {data.draftStats.needsReview}</div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-slate-200">Conflicts: {data.draftStats.conflicting}</div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-slate-200">Missing: {data.draftStats.missing}</div>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-4">
                <p className="text-sm font-semibold text-white">Next actions</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                  {data.nextActions.map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
            </div>
          </ExtractionReviewSection>

          <ExtractionReviewSection title="Uploaded evidence" description="Secure matter-linked files, extraction state, and draft/checklist links." icon="FileSearch">
            <div className="space-y-3">
              {data.documents.length ? data.documents.map((document) => (
                <div key={document.id} className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{document.fileName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{document.category}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill>{document.extractionStatus.replaceAll("_", " ")}</StatusPill>
                      <StatusPill tone={document.weakOcr ? "warning" : "success"}>{document.reviewStatus.replaceAll("_", " ")}</StatusPill>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-slate-200">Confidence: {document.extractionConfidence == null ? "Not scored" : `${Math.round(document.extractionConfidence * 100)}%`}</div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-slate-200">Draft links: {document.linkedDraftFields}</div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-slate-200">Checklist links: {document.linkedChecklistItems}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/app/documents/${document.id}` as any}><StatusPill tone="info">Open document</StatusPill></Link>
                    <Link href={document.downloadHref as any}><StatusPill>Secure download</StatusPill></Link>
                  </div>
                  {document.weakOcr ? <p className="mt-3 text-xs text-amber-300">OCR/scanned warning: this file may not provide strong text extraction.</p> : null}
                </div>
              )) : <p className="text-sm text-slate-400">No documents are linked to this matter yet.</p>}
            </div>
          </ExtractionReviewSection>

          <ExtractionReviewSection title="Staff action flags" description="Real rule-based warnings from checklist gaps, weak OCR, and draft conflicts." icon="FileWarning">
            <div className="space-y-3">
              {data.flags.length ? data.flags.map((flag) => <ExtractionAlert key={flag.id} flag={flag} />) : (
                <div className="rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/[0.08] p-4 text-sm text-emerald-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    No additional extraction flags are visible right now.
                  </div>
                  <p className="mt-2 leading-6 text-emerald-200/80">Agent review is still required before any client-facing use.</p>
                </div>
              )}
            </div>
          </ExtractionReviewSection>

          <ExtractionReviewSection title="Timeline and client activity" description="Appointment and portal status where it helps review readiness." icon="CalendarClock">
            <div className="space-y-3">
              <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-4">
                <div className="flex items-center gap-2 text-white">
                  <CalendarClock className="h-4 w-4 text-cyan-200" />
                  <p className="text-sm font-semibold">Client portal and review workflow</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={data.summary.portalHref as any}><StatusPill tone="info">Client portal access</StatusPill></Link>
                  <Link href={data.summary.draftHref as any}><StatusPill>Review application draft</StatusPill></Link>
                  <Link href={data.summary.formsHref as any}><StatusPill>Official forms</StatusPill></Link>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">Use the draft, forms, and client portal routes to continue the review chain. No internal notes or AI reasoning are exposed to clients.</p>
              </div>

              <div className="rounded-[1.2rem] border border-amber-400/20 bg-amber-400/[0.08] p-4">
                <div className="flex items-center gap-2 text-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-semibold">Review-required reminder</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-amber-200/80">
                  Unsafe fields such as passport numbers, DOB, declarations, health answers, and signatures must remain source-backed and agent-reviewed. Aria does not guess missing answers.
                </p>
              </div>
            </div>
          </ExtractionReviewSection>
        </div>
      </div>

      <ExtractionActionBar
        matterId={data.summary.matterId}
        draftHref={data.summary.draftHref}
        generatedDocumentsHref={data.summary.generatedDocumentsHref}
        formsHref={data.summary.formsHref}
        portalHref={data.summary.portalHref}
        exportHref={data.summary.exportHref}
        canRunAiDraftAutofill={data.summary.canRunAiDraftAutofill}
        canRunCrossCheck={data.summary.canRunCrossCheck}
        aiConfigured={data.summary.aiConfigured}
        privacyMode={privacyMode}
        onPrivacyToggle={() => setPrivacyMode((current) => !current)}
      />
    </div>
  );
}
