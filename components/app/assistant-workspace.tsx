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
    <div>
      <form onSubmit={ask} className="space-y-3">
        <select name="matterId" className="w-full rounded-lg border border-border bg-[#0d1728] p-2 text-sm">
          <option value="">Workspace mode</option>
          {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
        </select>
        <div className="flex gap-2">
          <input name="prompt" required className="w-full rounded-lg border border-border bg-[#0d1728] p-2" placeholder="Ask about missing evidence, conflicts, readiness, or update impacts..." />
          <button disabled={isLoading} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isLoading ? "Reviewing..." : "Ask"}</button>
        </div>
      </form>
      <div className="mt-3 min-h-72 rounded-lg border border-border bg-[#0c1525] p-3 text-sm text-muted">
        {reply ? (
          <div className="space-y-3">
            <p>{reply.content}</p>
            {reply.recommendedActions?.length ? (
              <div>
                <p className="font-medium text-white">Recommended next actions</p>
                <ul className="mt-2 list-disc pl-5">{reply.recommendedActions.map((action) => <li key={action}>{action}</li>)}</ul>
              </div>
            ) : null}
            {reply.citations?.length ? (
              <div>
                <p className="font-medium text-white">Grounding</p>
                <div className="mt-2 flex flex-wrap gap-2">{reply.citations.map((citation) => <a key={citation.href} href={citation.href} className="rounded bg-[#111a2b] px-2 py-1 text-accent">{citation.label}</a>)}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <p>Ask Aria a matter-aware question. Responses are grounded in stored matters, documents, draft fields, validation issues, and official update impacts.</p>
        )}
      </div>
    </div>
  );
}
