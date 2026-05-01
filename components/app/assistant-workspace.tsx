"use client";

import { FormEvent, useState } from "react";
import { AIInsightPanel } from "@/components/ui/ai-insight-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { GradientButton } from "@/components/ui/gradient-button";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";

type MatterOption = {
  id: string;
  label: string;
};

export type AssistantReply = {
  content: string;
  groundedFacts?: string[];
  reasoning?: string[];
  citations?: { label: string; href: string }[];
  recommendedActions?: string[];
  riskWarnings?: string[];
  reviewRequired?: boolean;
  setup?: string;
  configured?: boolean;
  error?: string;
};

export function AssistantWorkspace({
  matters,
  suggestions
}: {
  matters: MatterOption[];
  suggestions?: string[];
}) {
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [prompt, setPrompt] = useState("");

  const starterPrompts = suggestions?.length
    ? suggestions
    : [
      "Summarise this matter's missing evidence",
      "Draft a client email about missing documents",
      "Explain 189 vs 190 pathway considerations",
      "Review this matter for final cross-check blockers"
    ];

  async function submitPrompt(nextPrompt: string, matterId?: string) {
    setIsLoading(true);
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: nextPrompt, matterId: matterId || null })
    });

    const payload = await response.json();
    setReply(response.ok ? payload : { ...payload, content: payload.content ?? payload.error ?? "Aria could not complete the request.", error: payload.error });
    setIsLoading(false);
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPrompt(prompt, selectedMatterId);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard className="space-y-5">
          <form onSubmit={ask} className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <FormField label="Context">
                <select
                  name="matterId"
                  value={selectedMatterId}
                  onChange={(event) => setSelectedMatterId(event.target.value)}
                  className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
                >
                  <option value="">Workspace mode</option>
                  {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
                </select>
              </FormField>
              <FormField label="Ask Aria">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    name="prompt"
                    required
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
                    placeholder="Ask about missing evidence, conflicts, readiness, or update impacts..."
                  />
                  <GradientButton type="submit" disabled={isLoading} className="sm:min-w-32">
                    {isLoading ? "Reviewing..." : "Ask Aria"}
                  </GradientButton>
                </div>
              </FormField>
            </div>
          </form>
          <p className="text-xs text-slate-400">Ask for latest or official information to use the configured live web research provider. If no provider is configured, Aria will say so rather than inventing current policy.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {starterPrompts.map((starterPrompt) => (
              <button
                key={starterPrompt}
                type="button"
                onClick={() => {
                  setPrompt(starterPrompt);
                  void submitPrompt(starterPrompt, selectedMatterId);
                }}
                className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-left text-sm text-slate-200 transition hover:bg-white/[0.06]"
              >
                {starterPrompt}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="space-y-4">
          <p className="text-sm font-semibold text-slate-100">Grounding hierarchy</p>
          <div className="space-y-2 text-sm text-slate-400">
            <p>1. Stored matter, document, draft, validation, update, and pathway records</p>
            <p>2. Stored official visa knowledge records</p>
            <p>3. Live official web research when configured</p>
            <p>4. AI-assisted analysis with agent review required</p>
          </div>
        </SectionCard>
      </div>

      {reply ? (
        <PageSection eyebrow="Response" title="Aria review workspace">
          <AIInsightPanel
            eyebrow="Aria intelligence"
            title="Matter-aware operational guidance"
            summary={reply.content}
            statusLabel={reply.reviewRequired ? "Review required" : undefined}
            action={reply.configured === false ? <StatusPill tone="warning">Configuration required</StatusPill> : null}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard className="space-y-4">
                {reply.error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{reply.error}</p> : null}
                {reply.setup ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-400">{reply.setup}</p> : null}
                {reply.groundedFacts?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-white">Grounded facts</p>
                    <ul className="mt-3 grid gap-2">{reply.groundedFacts.map((fact) => <li key={fact} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-200">{fact}</li>)}</ul>
                  </div>
                ) : null}
                {reply.reasoning?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-white">AI-assisted reasoning</p>
                    <ul className="mt-3 space-y-2">{reply.reasoning.map((item) => <li key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">{item}</li>)}</ul>
                  </div>
                ) : null}
              </SectionCard>
              <SectionCard className="space-y-4">
                {reply.recommendedActions?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-white">Recommended next actions</p>
                    <ul className="mt-3 space-y-2">{reply.recommendedActions.map((action) => <li key={action} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-200">{action}</li>)}</ul>
                  </div>
                ) : null}
                {reply.riskWarnings?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-white">Risk warnings</p>
                    <ul className="mt-3 space-y-2">{reply.riskWarnings.map((warning) => <li key={warning} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-300">{warning}</li>)}</ul>
                  </div>
                ) : null}
                {reply.citations?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-white">Grounding</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {reply.citations.map((citation) => (
                        <a key={citation.href} href={citation.href} className="inline-flex items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-white/10 hover:text-cyan-200">
                          {citation.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                {reply.reviewRequired ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-400">AI-assisted output only. Registered migration agent review remains required.</p> : null}
              </SectionCard>
            </div>
          </AIInsightPanel>
        </PageSection>
      ) : (
        <EmptyState
          title="How can Aria help today?"
          description="Use a starter prompt or ask a workspace-aware question about evidence gaps, draft blockers, policy differences, or final review readiness."
          action={<SubtleButton type="button" onClick={() => setPrompt(starterPrompts[0] ?? "")}>Load a starter prompt</SubtleButton>}
        />
      )}
    </div>
  );
}
