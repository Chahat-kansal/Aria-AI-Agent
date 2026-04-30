"use client";

import { FormEvent, useState } from "react";

type MatterOption = {
  id: string;
  label: string;
};

type AssistantReply = {
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

export function AssistantWorkspace({ matters }: { matters: MatterOption[] }) {
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    const form = new FormData(event.currentTarget);
    const prompt = String(form.get("prompt") ?? "");
    const matterId = String(form.get("matterId") ?? "");

    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, matterId: matterId || null })
    });

    const payload = await response.json();
    setReply(response.ok ? payload : { ...payload, content: payload.content ?? payload.error ?? "Aria could not complete the request.", error: payload.error });
    setIsLoading(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={ask} className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
        <div className="space-y-4">
          <select name="matterId" className="w-full">
            <option value="">Workspace mode</option>
            {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
          </select>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input name="prompt" required className="w-full" placeholder="Ask about missing evidence, conflicts, readiness, or update impacts..." />
            <button disabled={isLoading} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95 disabled:opacity-60">
              {isLoading ? "Reviewing..." : "Ask"}
            </button>
          </div>
          <p className="text-xs text-slate-400">Ask for latest or official information to use the configured live web research provider. If no provider is configured, Aria will say so rather than inventing current policy.</p>
        </div>
      </form>

      <aside className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 text-sm text-slate-300 shadow-glass backdrop-blur-xl">
        <p className="text-sm font-semibold text-slate-100">Grounding hierarchy</p>
        <div className="mt-3 space-y-2 text-sm text-slate-400">
          <p>1. Stored matter, document, draft, validation, update, and pathway records</p>
          <p>2. Stored official visa knowledge records</p>
          <p>3. Live official web research when configured</p>
          <p>4. AI-assisted analysis with agent review required</p>
        </div>
      </aside>

      <div className="min-h-80 rounded-3xl border border-white/10 bg-slate-950/55 p-5 text-sm text-slate-300 shadow-glass backdrop-blur-xl xl:col-span-2">
        {reply ? (
          <div className="space-y-4">
            {reply.error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{reply.error}</p> : null}
            {reply.setup ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-400">{reply.setup}</p> : null}
            <p className="leading-7 text-slate-200">{reply.content}</p>
            {reply.groundedFacts?.length ? (
              <div>
                <p className="font-medium text-white">Grounded facts</p>
                <ul className="mt-2 grid gap-2 md:grid-cols-2">{reply.groundedFacts.map((fact) => <li key={fact} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">{fact}</li>)}</ul>
              </div>
            ) : null}
            {reply.reasoning?.length ? (
              <div>
                <p className="font-medium text-white">AI-assisted reasoning</p>
                <ul className="mt-2 space-y-2">{reply.reasoning.map((item) => <li key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">{item}</li>)}</ul>
              </div>
            ) : null}
            {reply.recommendedActions?.length ? (
              <div>
                <p className="font-medium text-white">Recommended next actions</p>
                <ul className="mt-2 grid gap-2 md:grid-cols-3">{reply.recommendedActions.map((action) => <li key={action} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">{action}</li>)}</ul>
              </div>
            ) : null}
            {reply.riskWarnings?.length ? (
              <div>
                <p className="font-medium text-white">Risk warnings</p>
                <ul className="mt-2 space-y-2">{reply.riskWarnings.map((warning) => <li key={warning} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-300">{warning}</li>)}</ul>
              </div>
            ) : null}
            {reply.citations?.length ? (
              <div>
                <p className="font-medium text-white">Grounding</p>
                <div className="mt-2 flex flex-wrap gap-2">{reply.citations.map((citation) => <a key={citation.href} href={citation.href} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-white/10 hover:text-cyan-200">{citation.label}</a>)}</div>
              </div>
            ) : null}
            {reply.reviewRequired ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-400">AI-assisted output only. Registered migration agent review remains required.</p> : null}
          </div>
        ) : (
          <p>Ask Aria a matter-aware or live official-source question. Responses are grounded in stored matters, documents, draft fields, validation issues, pathway analyses, visa knowledge, and official update impacts.</p>
        )}
      </div>
    </div>
  );
}
