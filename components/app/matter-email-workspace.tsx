"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";

type TemplateKey =
  | "document_request"
  | "confirmation_request"
  | "appointment_reminder"
  | "portal_invite_reminder"
  | "general_follow_up";

type TemplatePreview = {
  subject: string;
  bodyText: string;
  securePortalLink?: string | null;
  templateKey?: string | null;
};

type LinkedThread = {
  id: string;
  provider: string;
  externalThreadId: string;
  subjectPreview: string;
  fromPreview: string;
  toPreview: string[];
  messageCount: number;
  lastMessageAt: string | null;
  linkedBy: { id: string; name: string | null; email: string } | null;
  syncStatus: string;
  lastSyncAt: string | null;
  lastErrorSummary: string | null;
  bodyImportedAt: string | null;
  messages: Array<{
    id: string;
    direction: string;
    senderLabel: string;
    recipientLabels: string[];
    sentAt: string | null;
    subjectPreview: string;
    bodyImported: boolean;
    bodyPreview: string | null;
  }>;
};

type RecentThread = {
  externalThreadId: string;
  externalMessageId?: string | null;
  subjectPreview: string;
  fromPreview: string;
  toPreview: string[];
  lastMessageAt: string | null;
  messageCount: number;
};

const templateLabels: Record<TemplateKey, string> = {
  document_request: "Document request",
  confirmation_request: "Confirmation request",
  appointment_reminder: "Appointment reminder",
  portal_invite_reminder: "Portal reminder",
  general_follow_up: "General follow-up"
};

export function MatterEmailWorkspace(props: {
  matterId: string;
  provider: {
    providerName: string;
    configured: boolean;
    state: string;
    notes: string[];
    disabledReason?: string | null;
  };
  providerEnv: {
    gmailConfigured: boolean;
    microsoftConfigured: boolean;
  };
  connection: {
    connected?: boolean;
    connectedAccountLabel?: string | null;
    lastSyncAt?: string | null;
    lastErrorSummary?: string | null;
  } | null;
  linkedThreads: LinkedThread[];
  recentThreads: RecentThread[];
  templatePreviews: Record<TemplateKey, TemplatePreview>;
  canSend: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState(props.recentThreads[0]?.externalThreadId ?? "");
  const [sendOpen, setSendOpen] = useState(false);
  const [template, setTemplate] = useState<TemplateKey>("document_request");
  const [subject, setSubject] = useState(props.templatePreviews.document_request.subject);
  const [bodyText, setBodyText] = useState(props.templatePreviews.document_request.bodyText);
  const [warningMatches, setWarningMatches] = useState<string[]>([]);
  const [fallbackPayload, setFallbackPayload] = useState<TemplatePreview | null>(null);

  const selectedRecentThread = useMemo(
    () => props.recentThreads.find((item) => item.externalThreadId === selectedThreadId) ?? null,
    [props.recentThreads, selectedThreadId]
  );

  function applyTemplate(nextTemplate: TemplateKey) {
    setTemplate(nextTemplate);
    setSubject(props.templatePreviews[nextTemplate].subject);
    setBodyText(props.templatePreviews[nextTemplate].bodyText);
    setWarningMatches([]);
  }

  async function runAction(payload: Record<string, unknown>) {
    setIsBusy(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/matters/${props.matterId}/email-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);

      if (response.status === 409 && result?.warning) {
        setWarningMatches(Array.isArray(result.matches) ? result.matches : []);
        setFallbackPayload(result.payload ?? null);
        setError("Sensitive content warning. Remove sensitive details or confirm before sending.");
        return;
      }

      if (!response.ok) {
        setError(result?.reason || result?.error || "Unable to complete the email sync action right now.");
        return;
      }

      if (payload.action === "send_email") {
        if (result.delivered) {
          setStatus("Client email sent through the connected mailbox.");
          setSendOpen(false);
        } else if (result.fallbackMode === "manual_copy") {
          setFallbackPayload(result.payload ?? null);
          setStatus("Email sync provider not configured. Manual copy is available below.");
        } else {
          setStatus("Email workflow completed.");
        }
      } else if (payload.action === "link_thread") {
        setStatus("Mailbox thread metadata linked to the matter.");
      } else if (payload.action === "unlink_thread") {
        setStatus("Linked mailbox thread removed from the matter.");
      } else if (payload.action === "import_thread") {
        setStatus("Message preview import recorded for review.");
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to complete the email sync action right now.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Matter email workspace</h3>
            <StatusPill tone={props.provider.state === "disabled" ? "neutral" : props.provider.configured && props.connection?.connected ? "success" : "warning"}>
              {props.provider.state === "disabled" ? "Disabled" : props.provider.configured && props.connection?.connected ? "Connected" : props.provider.configured ? "Needs connection" : "Not configured"}
            </StatusPill>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Minimised mailbox metadata only by default. Sensitive client documents and visa details should be shared through the secure portal.
          </p>
        </div>
        {props.canSend ? (
          <GradientButton onClick={() => setSendOpen(true)} className="h-11 rounded-2xl px-5">
            Send client email
          </GradientButton>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Provider</p>
          <p className="mt-2 text-sm font-medium text-white">{props.provider.providerName}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Connected account</p>
          <p className="mt-2 text-sm font-medium text-white">{props.connection?.connectedAccountLabel || "Not connected"}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Gmail</p>
          <p className="mt-2 text-sm font-medium text-white">{props.providerEnv.gmailConfigured ? "Configured" : "Not configured"}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Outlook</p>
          <p className="mt-2 text-sm font-medium text-white">{props.providerEnv.microsoftConfigured ? "Configured" : "Not configured"}</p>
        </div>
      </div>

      {props.provider.disabledReason ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
          {props.provider.disabledReason} Manual Aria email and secure portal messaging remain available.
        </div>
      ) : null}

      {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Linked email threads</h4>
            <StatusPill tone={props.linkedThreads.length ? "info" : "neutral"}>{props.linkedThreads.length} linked</StatusPill>
          </div>

          {props.linkedThreads.length ? props.linkedThreads.map((thread) => (
            <div key={thread.id} className="space-y-3 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{thread.subjectPreview}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {thread.fromPreview} · {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString("en-AU") : "No timestamp"}
                  </p>
                </div>
                <StatusPill tone={thread.syncStatus === "FAILED" ? "danger" : thread.bodyImportedAt ? "success" : "warning"}>
                  {thread.syncStatus.replaceAll("_", " ")}
                </StatusPill>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="font-medium text-white">Recipients</p>
                  <p className="mt-2">{thread.toPreview.length ? thread.toPreview.join(", ") : "No recipient metadata stored"}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="font-medium text-white">Linked by</p>
                  <p className="mt-2">{thread.linkedBy?.name || thread.linkedBy?.email || "Unknown"}</p>
                </div>
              </div>

              {thread.messages.length ? (
                <div className="space-y-2">
                  {thread.messages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-300">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-white">{message.subjectPreview}</p>
                        <p>{message.sentAt ? new Date(message.sentAt).toLocaleString("en-AU") : "No timestamp"}</p>
                      </div>
                      <p className="mt-2">{message.senderLabel}</p>
                      {message.bodyPreview ? <p className="mt-2 leading-5 text-slate-400">{message.bodyPreview}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Thread content is not imported by default. Explicit preview import is review required.</p>
              )}

              {thread.lastErrorSummary ? <p className="text-xs text-rose-300">{thread.lastErrorSummary}</p> : null}

              <div className="flex flex-wrap gap-2">
                <SubtleButton
                  onClick={() => {
                    if (confirm("Import message preview metadata for this thread? This is review-required and not a full mailbox ingest.")) {
                      void runAction({ action: "import_thread", threadId: thread.id });
                    }
                  }}
                  disabled={isBusy}
                >
                  Import preview
                </SubtleButton>
                <SubtleButton
                  onClick={() => {
                    if (confirm("Unlink this thread from the matter?")) {
                      void runAction({ action: "unlink_thread", threadId: thread.id });
                    }
                  }}
                  disabled={isBusy}
                >
                  Unlink
                </SubtleButton>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
              No mailbox threads are linked to this matter yet. Link metadata manually only after checking matter permissions.
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Manual thread linking</h4>
            <p className="mt-2 text-sm text-slate-400">Recent mailbox metadata stays separate until an agent explicitly links a thread to this matter.</p>
          </div>

          <label className="space-y-2 text-sm font-medium text-white">
            <span>Recent mailbox thread</span>
            <select
              value={selectedThreadId}
              onChange={(event) => setSelectedThreadId(event.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white"
            >
              <option value="">Select recent thread metadata</option>
              {props.recentThreads.map((thread) => (
                <option key={thread.externalThreadId} value={thread.externalThreadId}>
                  {thread.subjectPreview} · {thread.fromPreview}
                </option>
              ))}
            </select>
          </label>

          {selectedRecentThread ? (
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">{selectedRecentThread.subjectPreview}</p>
              <p className="mt-2 text-xs text-slate-400">{selectedRecentThread.fromPreview}</p>
              <p className="mt-2 text-xs text-slate-400">
                {selectedRecentThread.lastMessageAt ? new Date(selectedRecentThread.lastMessageAt).toLocaleString("en-AU") : "No timestamp"} · {selectedRecentThread.messageCount} message(s)
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
              No recent metadata is available yet. This remains a safe disabled/config-missing state when the provider is not connected.
            </div>
          )}

          <SubtleButton
            onClick={() => selectedRecentThread && void runAction({ action: "link_thread", thread: selectedRecentThread })}
            disabled={isBusy || !selectedRecentThread}
            className="w-full justify-center"
          >
            Link selected thread metadata
          </SubtleButton>

          {fallbackPayload ? (
            <div className="space-y-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
              <p className="text-sm font-medium text-white">Manual fallback</p>
              <p className="text-xs text-amber-100/90">Email sync is unavailable or needs review. Copy this privacy-safe message into your approved send flow.</p>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-xs text-slate-200">
                <p><span className="text-slate-400">Subject:</span> {fallbackPayload.subject}</p>
                <pre className="mt-3 whitespace-pre-wrap text-slate-300">{fallbackPayload.bodyText}</pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {sendOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2rem] bg-[color:var(--surface-strong)] p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">SEND CLIENT EMAIL</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">Mailbox send with review</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">
                  Default templates stay generic and point clients back to the secure portal. Sensitive client facts should stay out of email unless your workspace policy explicitly allows them.
                </p>
              </div>
              <SubtleButton onClick={() => setSendOpen(false)} disabled={isBusy}>Close</SubtleButton>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Template</span>
                  <select
                    value={template}
                    onChange={(event) => applyTemplate(event.target.value as TemplateKey)}
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--bg-input)] px-4 text-sm text-[color:var(--text-primary)] outline-none"
                  >
                    {Object.entries(templateLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Subject</span>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--bg-input)] px-4 text-sm text-[color:var(--text-primary)] outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-[color:var(--text-primary)]">
                  <span>Body</span>
                  <textarea
                    value={bodyText}
                    onChange={(event) => setBodyText(event.target.value)}
                    rows={8}
                    className="min-h-44 w-full rounded-[1rem] bg-[color:var(--bg-input)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none"
                  />
                </label>

                {warningMatches.length ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                    <p className="font-medium text-white">Sensitive content warning</p>
                    <p className="mt-2">Detected patterns: {warningMatches.join(", ")}</p>
                    <p className="mt-2 text-xs text-rose-100/80">Remove sensitive content before sending, or explicitly confirm if your firm policy allows it.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SubtleButton
                        onClick={() => void runAction({
                          action: "send_email",
                          template,
                          subject,
                          bodyText,
                          confirmSensitiveContent: true,
                          requestOrigin: window.location.origin
                        })}
                        disabled={isBusy}
                      >
                        Send with explicit confirmation
                      </SubtleButton>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3">
                  <SubtleButton onClick={() => setSendOpen(false)} disabled={isBusy}>Cancel</SubtleButton>
                  <GradientButton
                    onClick={() => void runAction({
                      action: "send_email",
                      template,
                      subject,
                      bodyText,
                      requestOrigin: window.location.origin
                    })}
                    disabled={isBusy}
                  >
                    {isBusy ? "Sending..." : "Review and send"}
                  </GradientButton>
                </div>
              </div>

              <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">Preview</p>
                  <p className="mt-2 text-sm text-slate-400">This preview stays generic by default and avoids sensitive visa or document details.</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-200">
                  <p className="font-medium text-white">{subject}</p>
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{bodyText}</pre>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-xs text-slate-400">
                  <p>Connected mailbox: <span className="text-white">{props.connection?.connectedAccountLabel || "Not connected"}</span></p>
                  <p className="mt-2">Fallback: manual copy / approved transactional workflow when mailbox sync is not configured.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
