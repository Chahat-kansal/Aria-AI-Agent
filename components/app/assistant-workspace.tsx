"use client";

import { FormEvent, useState } from "react";

type MatterOption = {
  id: string;
  label: string;
};

type AssistantReply = {
  content: string;
  citations?: { label: string; href: string }[];
  recommendedActions?: string[];
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

    setReply(await response.json());
    setIsLoading(false);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={ask} className="panel space-y-3 p-4">
        <select name="matterId" className="w-full rounded-lg border border-border bg-white/70 p-2 text-sm">
          <option value="">Workspace mode</option>
          {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
        </select>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input name="prompt" required className="w-full rounded-lg border border-border bg-white/70 p-2" placeholder="Ask about missing evidence, conflicts, readiness, or update impacts..." />
          <button disabled={isLoading} className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{isLoading ? "Reviewing..." : "Ask"}</button>
        </div>
        <p className="text-xs text-muted">Ask for latest or official information to use the configured live web research provider. If no provider is configured, Aria will say so rather than inventing current policy.</p>
      </form>
      <aside className="panel p-4 text-sm text-muted">
        <p className="font-medium text-[#182033]">Grounding hierarchy</p>
        <div className="mt-3 space-y-2">
          <p>1. Stored matter, document, draft, validation, update, and pathway records</p>
          <p>2. Stored official visa knowledge records</p>
          <p>3. Live official web research when configured</p>
          <p>4. AI-assisted analysis with agent review required</p>
        </div>
      </aside>
      <div className="panel min-h-80 p-4 text-sm text-muted xl:col-span-2">
        {reply ? (
          <div className="space-y-4">
            <p className="leading-7">{reply.content}</p>
            {reply.recommendedActions?.length ? (
              <div>
                <p className="font-medium text-[#182033]">Recommended next actions</p>
                <ul className="mt-2 grid gap-2 md:grid-cols-3">{reply.recommendedActions.map((action) => <li key={action} className="rounded-lg border border-border bg-white/70 p-3">{action}</li>)}</ul>
              </div>
            ) : null}
            {reply.citations?.length ? (
              <div>
                <p className="font-medium text-[#182033]">Grounding</p>
                <div className="mt-2 flex flex-wrap gap-2">{reply.citations.map((citation) => <a key={citation.href} href={citation.href} className="rounded-lg border border-border bg-white/60 px-3 py-2 text-accent">{citation.label}</a>)}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <p>Ask Aria a matter-aware or live official-source question. Responses are grounded in stored matters, documents, draft fields, validation issues, pathway analyses, visa knowledge, and official update impacts.</p>
        )}
      </div>
    </div>
  );
}
