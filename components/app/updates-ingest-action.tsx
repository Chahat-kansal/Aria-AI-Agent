"use client";

import { useState } from "react";

type IngestResult = {
  status: string;
  message?: string;
  sources?: number;
  fetched?: number;
  stored?: number;
  impactedMatters?: number;
};

export function UpdatesIngestAction() {
  const [result, setResult] = useState<IngestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runIngestion() {
    setIsRunning(true);
    const response = await fetch("/api/updates/ingest", { method: "POST" });
    const payload = (await response.json()) as IngestResult;
    setResult(payload);
    setIsRunning(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={runIngestion}
        disabled={isRunning}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning ? "Checking sources..." : "Run source check"}
      </button>
      {result ? (
        <span className="text-xs text-muted">
          {result.status === "ok"
            ? `${result.fetched ?? 0} fetched · ${result.stored ?? 0} stored · ${result.impactedMatters ?? 0} matter alerts`
            : result.message ?? result.status}
        </span>
      ) : null}
    </div>
  );
}
