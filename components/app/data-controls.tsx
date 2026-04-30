"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";

type MatterOption = { id: string; title: string; clientName: string };
type ClientOption = { id: string; name: string };

export function DataControls({ matters, clients }: { matters: MatterOption[]; clients: ClientOption[] }) {
  const [exportOutput, setExportOutput] = useState<string | null>(null);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  async function exportData(exportType: "workspace" | "matter" | "client") {
    setError(null);
    setArchiveMessage(null);
    const response = await fetch("/api/settings/data/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exportType,
        matterId: exportType === "matter" ? selectedMatterId : undefined,
        clientId: exportType === "client" ? selectedClientId : undefined
      })
    });
    const result = await response.json().catch(() => null) as { error?: string; payload?: unknown } | null;
    if (!response.ok) {
      setError(result?.error ?? "Unable to export data.");
      return;
    }
    setExportOutput(JSON.stringify(result?.payload ?? {}, null, 2));
  }

  async function archiveRecord(type: "matter" | "client") {
    setError(null);
    setExportOutput(null);
    const response = await fetch("/api/settings/data/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        matterId: type === "matter" ? selectedMatterId : undefined,
        clientId: type === "client" ? selectedClientId : undefined
      })
    });
    const result = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    if (!response.ok) {
      setError(result?.error ?? "Unable to archive record.");
      return;
    }
    setArchiveMessage(result?.message ?? "Archive action completed.");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <select value={selectedMatterId} onChange={(event) => setSelectedMatterId(event.target.value)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15">
          <option value="">Choose matter for export/archive</option>
          {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.clientName} - {matter.title}</option>)}
        </select>
        <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15">
          <option value="">Choose client for export/archive</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" onClick={() => exportData("workspace")}>Export workspace</PrimaryButton>
        <SecondaryButton type="button" onClick={() => exportData("matter")} disabled={!selectedMatterId}>Export matter package</SecondaryButton>
        <SecondaryButton type="button" onClick={() => exportData("client")} disabled={!selectedClientId}>Export client data</SecondaryButton>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => archiveRecord("matter")} disabled={!selectedMatterId} className="inline-flex h-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 text-sm font-medium text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-50">Archive matter</button>
        <button type="button" onClick={() => archiveRecord("client")} disabled={!selectedClientId} className="inline-flex h-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 text-sm font-medium text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-50">Soft-delete client</button>
      </div>
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p> : null}
      {archiveMessage ? <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-sm text-emerald-100">{archiveMessage}</p> : null}
      {exportOutput ? <pre className="overflow-auto rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-xs text-slate-300">{exportOutput}</pre> : null}
    </div>
  );
}
