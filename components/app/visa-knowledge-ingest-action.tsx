"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VisaKnowledgeIngestAction() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runIngestion() {
    setIsRunning(true);
    setMessage(null);
    const response = await fetch("/api/visa-knowledge/ingest", { method: "POST" });
    const result = await response.json().catch(() => null) as { fetched?: number; stored?: number; error?: string } | null;
    setIsRunning(false);

    if (!response.ok) {
      setMessage(result?.error ?? "Unable to refresh visa knowledge.");
      return;
    }

    setMessage(`Refreshed ${result?.stored ?? 0} knowledge records from ${result?.fetched ?? 0} source results.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={runIngestion} disabled={isRunning} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {isRunning ? "Refreshing..." : "Refresh official visa knowledge"}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
