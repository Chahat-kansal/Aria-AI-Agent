"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

type Result = {
  id: string;
  title: string;
  subclassCode: string | null;
  stream: string | null;
  summary: string;
  sourceType: string;
  lastRefreshedAt: string;
};

export function VisaKnowledgeSearch({ defaultValue = "", compact = false }: { defaultValue?: string; compact?: boolean }) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      const response = await fetch(`/api/visa-knowledge/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal }).catch(() => null);
      if (!response?.ok) {
        setStatus("error");
        setResults([]);
        return;
      }
      const payload = (await response.json()) as { results?: Result[] };
      setResults(payload.results ?? []);
      setStatus("ready");
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <form action="/app/knowledge" className={compact ? "relative flex min-w-full items-center gap-3 xl:min-w-[420px]" : "relative flex w-full flex-col gap-3 sm:flex-row"}>
      <div className="relative flex h-14 flex-1 items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-300 backdrop-blur-xl">
        <Search className="h-5 w-5 shrink-0 text-slate-500" />
        <input name="q" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search visa knowledge" className="w-full bg-transparent p-0 text-sm text-white placeholder:text-slate-500 focus:ring-0" placeholder="Search subclass, visa name, pathway, evidence..." />
        {query.trim().length >= 2 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-glass backdrop-blur-xl">
            {status === "loading" ? <p className="p-4 text-xs text-slate-400">Searching stored visa knowledge...</p> : null}
            {status === "error" ? <p className="p-4 text-xs text-slate-400">Search is unavailable for your current session or permissions.</p> : null}
            {status === "ready" && results.length === 0 ? <p className="p-4 text-xs text-slate-400">No matching records. Try a subclass number, visa name, or evidence term.</p> : null}
            {results.map((record) => (
              <Link key={record.id} href={`/app/knowledge/${record.id}` as any} className="block border-t border-white/5 px-4 py-3 text-left hover:bg-white/[0.04]">
                <p className="text-sm font-medium text-white">{record.subclassCode ? `Subclass ${record.subclassCode} - ` : ""}{record.title}</p>
                <p className="line-clamp-2 text-xs text-slate-400">{record.summary}</p>
                <p className="mt-1 text-[11px] text-slate-500">{record.sourceType} - updated {new Date(record.lastRefreshedAt).toLocaleDateString("en-AU")}</p>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95">
        Search
      </button>
    </form>
  );
}
