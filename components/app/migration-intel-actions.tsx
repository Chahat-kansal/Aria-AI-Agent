"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { SubtleButton } from "@/components/ui/subtle-button";

const defaultSeverity = "INFO";

export function MigrationIntelActions({
  canSweep,
  canLog
}: {
  canSweep: boolean;
  canLog: boolean;
}) {
  const router = useRouter();
  const [isSweeping, setIsSweeping] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function sweepNow() {
    setIsSweeping(true);
    setStatus(null);
    try {
      const response = await fetch("/api/updates/sweep", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(payload?.error ?? "Unable to run the migration intelligence sweep.");
        return;
      }
      router.refresh();
      const summary =
        payload?.message ??
        `${payload?.fetched ?? 0} fetched, ${payload?.added ?? 0} added, ${payload?.skipped ?? 0} skipped, ${payload?.impactedMatters ?? 0} matter impact(s) matched.`;
      setStatus(payload?.warning ? `${summary} ${payload.warning}` : summary);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to run the migration intelligence sweep.");
    } finally {
      setIsSweeping(false);
    }
  }

  async function saveLog(formData: FormData) {
    setIsSaving(true);
    setStatus(null);

    const payload = {
      title: String(formData.get("title") || ""),
      sourceUrl: String(formData.get("sourceUrl") || ""),
      sourceName: String(formData.get("sourceName") || "Workspace note"),
      summary: String(formData.get("summary") || ""),
      severity: String(formData.get("severity") || defaultSeverity),
      affectedSubclasses: String(formData.get("affectedSubclasses") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      tags: String(formData.get("tags") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    };

    const response = await fetch("/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null);
    setIsSaving(false);

    if (!response.ok) {
      setStatus(result?.error ?? "Unable to save that update note right now.");
      return;
    }

    setModalOpen(false);
    router.refresh();
    setStatus("Workspace migration note saved.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveLog(new FormData(event.currentTarget));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {canSweep ? (
        <SubtleButton onClick={sweepNow} disabled={isSweeping} className="h-12 rounded-[1.5rem] px-5">
          {isSweeping ? "Sweeping..." : "Sweep now"}
        </SubtleButton>
      ) : null}
      {canLog ? (
        <GradientButton onClick={() => setModalOpen(true)} className="h-12 rounded-[1.5rem] px-6">
          Log update
        </GradientButton>
      ) : null}
      {status ? <p className="w-full text-xs text-slate-400">{status}</p> : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] bg-[color:var(--surface-strong)] p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">FIRM NOTE</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">Log migration intelligence</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">
                  Record a real workspace note, source, or risk observation. Notes stay clearly marked as firm notes and do not pretend to be official policy.
                </p>
              </div>
              <SubtleButton onClick={() => setModalOpen(false)}>Close</SubtleButton>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Title</span>
                  <input
                    name="title"
                    required
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--bg-input)] px-4 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] outline-none focus:ring-2 focus:ring-violet-400/20"
                    placeholder="e.g. Student visa evidence checklist change"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Source name</span>
                  <input
                    name="sourceName"
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--bg-input)] px-4 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] outline-none focus:ring-2 focus:ring-violet-400/20"
                    placeholder="Workspace note"
                    defaultValue="Workspace note"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Source URL</span>
                  <input
                    name="sourceUrl"
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--bg-input)] px-4 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] outline-none focus:ring-2 focus:ring-violet-400/20"
                    placeholder="Optional source link"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Source type</span>
                  <input
                    value="FIRM_NOTE"
                    readOnly
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--bg-input)] px-4 text-sm text-[color:var(--text-secondary)] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Severity</span>
                  <select
                    name="severity"
                    defaultValue={defaultSeverity}
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--bg-input)] px-4 text-sm text-[color:var(--text-primary)] outline-none focus:ring-2 focus:ring-violet-400/20"
                  >
                    {["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                <span>Summary</span>
                <textarea
                  name="summary"
                  required
                  rows={5}
                  className="min-h-32 w-full rounded-[1rem] bg-[color:var(--bg-input)] px-4 py-3 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] outline-none focus:ring-2 focus:ring-violet-400/20"
                  placeholder="What changed, who it may affect, and what the team should review."
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Affected subclasses</span>
                  <input
                    name="affectedSubclasses"
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--bg-input)] px-4 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] outline-none focus:ring-2 focus:ring-violet-400/20"
                    placeholder="500, 482, 189"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Tags</span>
                  <input
                    name="tags"
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--bg-input)] px-4 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] outline-none focus:ring-2 focus:ring-violet-400/20"
                    placeholder="policy, evidence, processing"
                  />
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <SubtleButton onClick={() => setModalOpen(false)} disabled={isSaving}>Cancel</SubtleButton>
                <GradientButton type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save update"}
                </GradientButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
