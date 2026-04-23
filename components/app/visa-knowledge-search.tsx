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
    <form action="/app/knowledge" className={compact ? "relative flex min-w-full items-center gap-2 sm:min-w-[320px]" : "relative flex w-full flex-col gap-2 sm:flex-row"}>
      <div className="relative flex flex-1 items-center gap-2 rounded-lg border border-border bg-white/70 px-3 py-2 text-sm text-muted">
        <Search className="h-4 w-4 shrink-0" />
        <input name="q" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search visa knowledge" className="w-full bg-transparent p-0 text-sm" placeholder="Search subclass, visa name, pathway, evidence..." />
        {query.trim().length >= 2 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border border-border bg-white shadow-premium">
            {status === "loading" ? <p className="p-3 text-xs text-muted">Searching stored visa knowledge...</p> : null}
            {status === "error" ? <p className="p-3 text-xs text-muted">Search is unavailable for your current session or permissions.</p> : null}
            {status === "ready" && results.length === 0 ? <p className="p-3 text-xs text-muted">No matching records. Try a subclass number, visa name, or evidence term.</p> : null}
            {results.map((record) => (
              <Link key={record.id} href={`/app/knowledge/${record.id}` as any} className="block border-t border-border px-3 py-2 text-left hover:bg-[#f5f7ff]">
                <p className="text-sm font-medium text-[#182033]">{record.subclassCode ? `Subclass ${record.subclassCode} - ` : ""}{record.title}</p>
                <p className="line-clamp-2 text-xs text-muted">{record.summary}</p>
                <p className="mt-1 text-[11px] text-muted">{record.sourceType} - updated {new Date(record.lastRefreshedAt).toLocaleDateString("en-AU")}</p>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <button className="rounded-lg bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white">
        Search
      </button>
    </form>
  );
}
