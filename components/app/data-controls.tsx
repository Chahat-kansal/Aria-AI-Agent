"use client";

import { useState } from "react";

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
        <select value={selectedMatterId} onChange={(event) => setSelectedMatterId(event.target.value)} className="rounded-lg border border-border bg-white/70 p-2 text-sm">
          <option value="">Choose matter for export/archive</option>
          {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.clientName} - {matter.title}</option>)}
        </select>
        <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="rounded-lg border border-border bg-white/70 p-2 text-sm">
          <option value="">Choose client for export/archive</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => exportData("workspace")} className="rounded-lg border border-border bg-white/70 px-4 py-2 text-sm text-accent">Export workspace</button>
        <button type="button" onClick={() => exportData("matter")} disabled={!selectedMatterId} className="rounded-lg border border-border bg-white/70 px-4 py-2 text-sm text-accent disabled:opacity-50">Export matter package</button>
        <button type="button" onClick={() => exportData("client")} disabled={!selectedClientId} className="rounded-lg border border-border bg-white/70 px-4 py-2 text-sm text-accent disabled:opacity-50">Export client data</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => archiveRecord("matter")} disabled={!selectedMatterId} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 disabled:opacity-50">Archive matter</button>
        <button type="button" onClick={() => archiveRecord("client")} disabled={!selectedClientId} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 disabled:opacity-50">Soft-delete client</button>
      </div>
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p> : null}
      {archiveMessage ? <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-sm text-emerald-100">{archiveMessage}</p> : null}
      {exportOutput ? <pre className="overflow-auto rounded-lg border border-border bg-white/55 p-4 text-xs text-muted">{exportOutput}</pre> : null}
    </div>
  );
}
