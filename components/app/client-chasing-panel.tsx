"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";

type Channel = "portal" | "email" | "sms" | "push";
type SourceType = "missing_documents" | "pending_confirmation" | "appointment" | "unpaid_invoice" | "unread_portal_message";

type PendingItem = {
  sourceId: string;
  sourceType: SourceType;
  label: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhoneLast4: string | null;
  matterId: string | null;
  matterReference: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  dueAt: string | null;
  lastAttemptAt: string | null;
  lastStatus: string | null;
  recommendedChannels: Channel[];
  blockedReasons: string[];
};

type PreviewPayload = {
  candidate: PendingItem;
  preview: {
    sourceType: SourceType;
    channel: Channel;
    label: string;
    subject: string | null;
    body: string;
    route: string | null;
  };
};

export function ClientChasingPanel(props: {
  settings: {
    enabled: boolean;
    autoSendEnabled: boolean;
    consentRequired: boolean;
    frequencyHours: number;
    channels: Record<Channel, boolean>;
    quietHours: { enabled: boolean; start: string | null; end: string | null; timezone: string | null; placeholder: boolean };
  };
  pending: PendingItem[];
  history: Array<{
    id: string;
    sourceType: string;
    channel: string;
    status: string;
    mode: string;
    createdAt: string;
    processedAt: string | null;
    blockedReason: string | null;
    clientName: string;
    matterReference: string | null;
    preview: { subject?: string | null; body: string; route?: string | null } | null;
  }>;
  audit: Array<{ id: string; action: string; createdAt: string; metadata: Record<string, unknown> }>;
  preferences: Array<{
    clientId: string;
    clientName: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    portalEnabled: boolean;
    optedOutNonEssential: boolean;
  }>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(props.preferences[0]?.clientId ?? props.pending[0]?.clientId ?? "");
  const [settings, setSettings] = useState(props.settings);

  const selectedPreference = useMemo(
    () => props.preferences.find((item) => item.clientId === selectedClientId) ?? null,
    [props.preferences, selectedClientId]
  );

  const [preferenceForm, setPreferenceForm] = useState({
    emailEnabled: selectedPreference?.emailEnabled ?? false,
    smsEnabled: selectedPreference?.smsEnabled ?? false,
    pushEnabled: selectedPreference?.pushEnabled ?? false,
    portalEnabled: selectedPreference?.portalEnabled ?? true,
    optedOutNonEssential: selectedPreference?.optedOutNonEssential ?? false
  });

  function syncPreferenceForm(nextClientId: string) {
    const preference = props.preferences.find((item) => item.clientId === nextClientId);
    setSelectedClientId(nextClientId);
    setPreferenceForm({
      emailEnabled: preference?.emailEnabled ?? false,
      smsEnabled: preference?.smsEnabled ?? false,
      pushEnabled: preference?.pushEnabled ?? false,
      portalEnabled: preference?.portalEnabled ?? true,
      optedOutNonEssential: preference?.optedOutNonEssential ?? false
    });
  }

  async function runAction(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/chasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || "Unable to complete the client chasing action right now.");
        return null;
      }
      return result;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to complete the client chasing action right now.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    const result = await runAction({ action: "save_settings", ...settings });
    if (!result) return;
    setStatus("Workspace chasing settings saved.");
    router.refresh();
  }

  async function savePreference() {
    if (!selectedClientId) {
      setError("Choose a client preference row first.");
      return;
    }
    const result = await runAction({
      action: "save_preference",
      clientId: selectedClientId,
      ...preferenceForm
    });
    if (!result) return;
    setStatus("Client preference updated.");
    router.refresh();
  }

  async function previewReminder(item: PendingItem, channel: Channel) {
    const result = await runAction({
      action: "preview",
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      channel
    });
    if (!result) return;
    setPreview(result as PreviewPayload);
    setStatus("Reminder preview ready for review.");
  }

  async function sendPreview() {
    if (!preview) return;
    const result = await runAction({
      action: "send",
      sourceType: preview.candidate.sourceType,
      sourceId: preview.candidate.sourceId,
      channel: preview.preview.channel
    });
    if (!result) return;
    setStatus(result.delivered ? "Reminder sent." : result.reason || "Reminder blocked.");
    router.refresh();
  }

  async function runCheck() {
    const result = await runAction({ action: "run_check" });
    if (!result) return;
    setStatus(`Schedule check completed. Pending ${result.pending}, eligible ${result.eligible}, sent ${result.sent}.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Chasing dashboard</h2>
            <StatusPill tone={settings.enabled ? "warning" : "neutral"}>
              {settings.enabled ? "Enabled" : "Disabled by default"}
            </StatusPill>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Safe client chasing stays generic, requires consent/preferences, and never includes sensitive visa, identity, health, character, financial, or document details.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <GradientButton onClick={() => void runCheck()} className="h-11 rounded-2xl px-5" disabled={busy}>
            Run schedule check
          </GradientButton>
          <SubtleButton onClick={() => void saveSettings()} className="h-11 rounded-2xl px-5" disabled={busy}>
            Save settings
          </SubtleButton>
        </div>
      </div>

      {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.95fr)]">
        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Workspace chasing settings</h3>
            <StatusPill tone={settings.autoSendEnabled ? "warning" : "success"}>
              {settings.autoSendEnabled ? "Auto-send enabled" : "Auto-send off by default"}
            </StatusPill>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
              <span className="font-medium text-white">Workspace opt-in</span>
              <div className="mt-3 flex items-center gap-2">
                <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} />
                <span>Enable chasing for this workspace</span>
              </div>
            </label>
            <label className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
              <span className="font-medium text-white">Auto-send</span>
              <div className="mt-3 flex items-center gap-2">
                <input type="checkbox" checked={settings.autoSendEnabled} onChange={(event) => setSettings((current) => ({ ...current, autoSendEnabled: event.target.checked }))} />
                <span>Disabled by default unless explicitly enabled</span>
              </div>
            </label>
            <label className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
              <span className="font-medium text-white">Consent required</span>
              <div className="mt-3 flex items-center gap-2">
                <input type="checkbox" checked={settings.consentRequired} onChange={(event) => setSettings((current) => ({ ...current, consentRequired: event.target.checked }))} />
                <span>Block non-essential chasing without client preferences</span>
              </div>
            </label>
            <label className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
              <span className="font-medium text-white">Frequency</span>
              <input
                type="number"
                min={1}
                max={168}
                value={settings.frequencyHours}
                onChange={(event) => setSettings((current) => ({ ...current, frequencyHours: Number(event.target.value || 48) }))}
                className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white"
              />
              <p className="mt-2 text-xs text-slate-400">Rate limiting uses the last successful send within this many hours.</p>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(["portal", "email", "sms", "push"] as Channel[]).map((channel) => (
              <label key={channel} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                <span className="font-medium capitalize text-white">{channel}</span>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.channels[channel]}
                    onChange={(event) => setSettings((current) => ({
                      ...current,
                      channels: { ...current.channels, [channel]: event.target.checked }
                    }))}
                  />
                  <span>{settings.channels[channel] ? "Enabled" : "Disabled"}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
            <p className="font-medium text-white">Quiet hours</p>
            <p className="mt-2">
              {settings.quietHours.enabled
                ? `Enabled ${settings.quietHours.start || "--:--"} to ${settings.quietHours.end || "--:--"} (${settings.quietHours.timezone || "workspace timezone"})`
                : settings.quietHours.placeholder
                  ? "Placeholder only. Quiet hours can be added later without changing safe defaults."
                  : "Disabled"}
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Client consent and opt-out</h3>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Select client</span>
            <select
              value={selectedClientId}
              onChange={(event) => syncPreferenceForm(event.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white"
            >
              <option value="">Choose client</option>
              {[...props.preferences, ...props.pending.filter((item) => !props.preferences.some((pref) => pref.clientId === item.clientId)).map((item) => ({
                clientId: item.clientId,
                clientName: item.clientName
              }))].map((item: any) => (
                <option key={item.clientId} value={item.clientId}>{item.clientName}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["emailEnabled", "Email"],
              ["smsEnabled", "SMS"],
              ["pushEnabled", "Push"],
              ["portalEnabled", "Portal"]
            ] as const).map(([key, label]) => (
              <label key={key} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                <span className="font-medium text-white">{label}</span>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferenceForm[key]}
                    onChange={(event) => setPreferenceForm((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  <span>{preferenceForm[key] ? "Allowed" : "Blocked"}</span>
                </div>
              </label>
            ))}
          </div>
          <label className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            <span className="font-medium text-white">Opt-out</span>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferenceForm.optedOutNonEssential}
                onChange={(event) => setPreferenceForm((current) => ({ ...current, optedOutNonEssential: event.target.checked }))}
              />
              <span>Opt-out blocks non-essential chasing</span>
            </div>
          </label>
          <SubtleButton onClick={() => void savePreference()} className="h-11 rounded-2xl px-5" disabled={busy || !selectedClientId}>
            Save client preference
          </SubtleButton>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.95fr)]">
        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Pending chases</h3>
            <StatusPill tone={props.pending.length ? "warning" : "success"}>{props.pending.length} pending</StatusPill>
          </div>
          {props.pending.length ? props.pending.map((item) => (
            <div key={`${item.sourceType}:${item.sourceId}`} className="space-y-3 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.clientName} · {item.matterReference || "No matter reference"} · {item.assignedToUserName || "Unassigned"}
                  </p>
                </div>
                <StatusPill tone={item.blockedReasons.length ? "warning" : item.recommendedChannels.length ? "success" : "neutral"}>
                  {item.blockedReasons.length ? "Blocked" : item.recommendedChannels.length ? "Ready" : "Needs review"}
                </StatusPill>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="font-medium text-white">Due / last activity</p>
                  <p className="mt-2">{item.dueAt ? new Date(item.dueAt).toLocaleString("en-AU") : "No due date"}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="font-medium text-white">Last attempt</p>
                  <p className="mt-2">{item.lastAttemptAt ? `${new Date(item.lastAttemptAt).toLocaleString("en-AU")} · ${item.lastStatus || "Unknown"}` : "No chase recorded yet"}</p>
                </div>
              </div>
              {item.blockedReasons.length ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
                  {item.blockedReasons.join(" ")}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {(item.recommendedChannels.length ? item.recommendedChannels : (["portal"] as Channel[])).map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => void previewReminder(item, channel)}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white"
                    disabled={busy}
                  >
                    Preview {channel}
                  </button>
                ))}
              </div>
            </div>
          )) : <p className="text-sm text-slate-400">No pending chases are in scope right now.</p>}
        </div>

        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Reminder preview</h3>
          {preview ? (
            <div className="space-y-4 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{preview.preview.label}</p>
                <StatusPill tone="info">{preview.preview.channel}</StatusPill>
              </div>
              {preview.preview.subject ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Subject</p>
                  <p className="mt-2 text-sm text-slate-200">{preview.preview.subject}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Body</p>
                <p className="mt-2 text-sm leading-6 text-slate-200 whitespace-pre-wrap">{preview.preview.body}</p>
              </div>
              <p className="text-xs text-slate-400">Agents can preview before sending. Auto-send remains off by default unless explicitly enabled.</p>
              <GradientButton onClick={() => void sendPreview()} className="h-11 rounded-2xl px-5" disabled={busy}>
                Send reminder
              </GradientButton>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Choose a pending chase and preview a channel before sending.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.95fr)]">
        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Sent and blocked history</h3>
            <StatusPill tone="neutral">{props.history.length} rows</StatusPill>
          </div>
          <div className="space-y-3">
            {props.history.length ? props.history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-white">{item.clientName}</p>
                  <StatusPill tone={item.status === "SENT" ? "success" : item.status === "RATE_LIMITED" ? "warning" : item.status === "BLOCKED" ? "warning" : "neutral"}>
                    {item.status.replaceAll("_", " ").toLowerCase()}
                  </StatusPill>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {item.sourceType.replaceAll("_", " ")} · {item.channel} · {new Date(item.createdAt).toLocaleString("en-AU")}
                </p>
                {item.preview?.body ? <p className="mt-2 text-sm text-slate-300">{item.preview.body}</p> : null}
                {item.blockedReason ? <p className="mt-2 text-xs text-amber-200">{item.blockedReason}</p> : null}
              </div>
            )) : <p className="text-sm text-slate-400">No chase history yet.</p>}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Redacted audit view</h3>
          <div className="space-y-3">
            {props.audit.length ? props.audit.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-slate-300">
                <p className="font-medium text-white">{item.action}</p>
                <p className="mt-1 text-slate-400">{new Date(item.createdAt).toLocaleString("en-AU")}</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[11px] text-slate-300">{JSON.stringify(item.metadata, null, 2)}</pre>
              </div>
            )) : <p className="text-sm text-slate-400">No chase audit rows yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
