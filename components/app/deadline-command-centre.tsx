"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";

type DeadlineItem = {
  id: string;
  deadlineId: string | null;
  kind: "manual" | "calculated" | "suggested";
  category: string;
  categoryLabel: string;
  title: string;
  safeSummary: string | null;
  dueAt: string;
  urgency: "overdue" | "urgent" | "upcoming" | "watch";
  daysUntil: number;
  reviewRequired: boolean;
  clientFacing: boolean;
  clientVisible: boolean;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  sourceLabel: string | null;
  matterId: string | null;
  matterReference: string | null;
  clientId: string | null;
  clientName: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  route: string | null;
  lastReminderAt: string | null;
  reminderStatus: string | null;
  canEdit: boolean;
  canComplete: boolean;
  canSendReminder: boolean;
};

type DeadlineDashboard = {
  summary: {
    all: number;
    overdue: number;
    urgent: number;
    upcoming: number;
    reviewRequired: number;
    missingEvidence: number;
  };
  items: DeadlineItem[];
  history: Array<{
    id: string;
    deadlineId: string | null;
    eventType: string;
    createdAt: string;
    status: string | null;
    summary: string | null;
  }>;
  audit: Array<{
    id: string;
    action: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
};

type MatterOption = { id: string; label: string; matterReference: string | null };
type UserOption = { id: string; name: string; email: string | null };

type FilterKey = "all" | "overdue" | "urgent" | "upcoming" | "review_required" | "missing_evidence" | "completed";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function urgencyTone(value: DeadlineItem["urgency"]) {
  if (value === "overdue") return "danger";
  if (value === "urgent") return "warning";
  if (value === "upcoming") return "info";
  return "neutral";
}

export function DeadlineCommandCentre(props: {
  dashboard: DeadlineDashboard;
  matters: MatterOption[];
  users: UserOption[];
  initialMatterId?: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    item: DeadlineItem;
    preview: { channel: string; subject: string | null; body: string; route: string | null; blockedReason: string | null };
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    matterId: props.initialMatterId || "",
    assignedToUserId: "",
    title: "",
    safeSummary: "",
    dueAt: "",
    category: "manual",
    reviewRequired: true,
    clientVisible: false
  });

  const visibleItems = useMemo(() => {
    return props.dashboard.items.filter((item) => {
      if (filter === "completed") return item.status === "COMPLETED";
      if (item.status !== "OPEN") return false;
      if (filter === "all") return true;
      if (filter === "overdue") return item.urgency === "overdue";
      if (filter === "urgent") return item.urgency === "urgent";
      if (filter === "upcoming") return item.urgency === "upcoming";
      if (filter === "review_required") return item.reviewRequired;
      if (filter === "missing_evidence") return item.category === "missing_evidence";
      return true;
    });
  }, [filter, props.dashboard.items]);

  async function runAction(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || "Unable to complete the deadline action right now.");
        return null;
      }
      return result;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to complete the deadline action right now.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function loadDeadlineForEdit(item: DeadlineItem) {
    setEditingId(item.deadlineId);
    setForm({
      matterId: item.matterId || props.initialMatterId || "",
      assignedToUserId: item.assignedToUserId || "",
      title: item.title,
      safeSummary: item.safeSummary || "",
      dueAt: item.dueAt.slice(0, 16),
      category: item.category,
      reviewRequired: item.reviewRequired,
      clientVisible: item.clientVisible
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      matterId: props.initialMatterId || "",
      assignedToUserId: "",
      title: "",
      safeSummary: "",
      dueAt: "",
      category: "manual",
      reviewRequired: true,
      clientVisible: false
    });
  }

  async function saveDeadline() {
    const payload = {
      action: editingId ? "update" : "create",
      ...(editingId ? { deadlineId: editingId } : {}),
      ...form,
      matterId: form.matterId || null,
      assignedToUserId: form.assignedToUserId || null,
      safeSummary: form.safeSummary || null,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : ""
    };
    const result = await runAction(payload);
    if (!result) return;
    setStatus(editingId ? "Deadline updated." : "Deadline created.");
    resetForm();
    router.refresh();
  }

  async function completeDeadline(item: DeadlineItem) {
    const result = await runAction({ action: "complete", deadlineId: item.deadlineId });
    if (!result) return;
    setStatus("Deadline completed.");
    router.refresh();
  }

  async function openPreview(item: DeadlineItem) {
    const result = await runAction({ action: "preview", itemId: item.id });
    if (!result) return;
    setPreview(result);
    setStatus("Reminder preview ready for review.");
  }

  async function sendReminder() {
    if (!preview) return;
    const result = await runAction({
      action: "send_reminder",
      itemId: preview.item.id,
      channel: preview.preview.channel
    });
    if (!result) return;
    setStatus(result.delivered ? "Reminder sent." : result.reason || "Reminder blocked.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Deadline command centre</h2>
            <StatusPill tone="warning">Agent review required</StatusPill>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Suggested and calculated dates are operational prompts only. They stay review-required until a migration agent checks the legal basis and next action.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["all", `${props.dashboard.summary.all} open`],
            ["overdue", `${props.dashboard.summary.overdue} overdue`],
            ["urgent", `${props.dashboard.summary.urgent} urgent`],
            ["upcoming", `${props.dashboard.summary.upcoming} upcoming`],
            ["review_required", `${props.dashboard.summary.reviewRequired} review required`],
            ["missing_evidence", `${props.dashboard.summary.missingEvidence} missing evidence`],
            ["completed", "Completed"]
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-2xl border px-4 py-2 text-sm transition ${
                filter === key ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.9fr)]">
        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Deadline dashboard</h3>
            <StatusPill tone={visibleItems.some((item) => item.urgency === "overdue") ? "danger" : visibleItems.some((item) => item.urgency === "urgent") ? "warning" : "success"}>
              {visibleItems.length} visible
            </StatusPill>
          </div>
          <div className="space-y-3">
            {visibleItems.length ? visibleItems.map((item) => (
              <div key={item.id} className="space-y-3 rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <StatusPill tone={urgencyTone(item.urgency)}>{item.urgency}</StatusPill>
                      <StatusPill tone={item.kind === "manual" ? "info" : "warning"}>{item.kind}</StatusPill>
                      {item.reviewRequired ? <StatusPill tone="warning">Review required</StatusPill> : null}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {item.categoryLabel} · {item.matterReference || "No matter reference"} · {item.assignedToUserName || "Unassigned"} · Due {formatDate(item.dueAt)}
                    </p>
                    {item.safeSummary ? <p className="mt-2 text-sm leading-6 text-slate-300">{item.safeSummary}</p> : null}
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>{item.daysUntil < 0 ? `${Math.abs(item.daysUntil)} day(s) overdue` : `${item.daysUntil} day(s)`}</p>
                    <p className="mt-1">{item.sourceLabel || "Derived deadline"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.canSendReminder ? (
                    <GradientButton onClick={() => void openPreview(item)} className="h-10 rounded-2xl px-4" disabled={busy}>
                      Preview reminder
                    </GradientButton>
                  ) : null}
                  {item.route ? (
                    <a href={item.route} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-200">
                      Open matter
                    </a>
                  ) : null}
                  {item.canEdit && item.deadlineId ? (
                    <SubtleButton onClick={() => loadDeadlineForEdit(item)} className="h-10 rounded-2xl px-4" disabled={busy}>
                      Edit
                    </SubtleButton>
                  ) : null}
                  {item.canComplete ? (
                    <SubtleButton onClick={() => void completeDeadline(item)} className="h-10 rounded-2xl px-4" disabled={busy}>
                      Complete
                    </SubtleButton>
                  ) : null}
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
                No deadlines match this filter right now.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">{editingId ? "Edit deadline" : "Create deadline"}</h3>
              {editingId ? (
                <SubtleButton onClick={resetForm} className="h-10 rounded-2xl px-4" disabled={busy}>
                  Cancel edit
                </SubtleButton>
              ) : null}
            </div>

            <div className="grid gap-3">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Title</span>
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white" />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Safe summary</span>
                <textarea value={form.safeSummary} onChange={(event) => setForm((current) => ({ ...current, safeSummary: event.target.value }))} className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white" />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Due</span>
                  <input type="datetime-local" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Category</span>
                  <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white">
                    <option value="manual">Manual</option>
                    <option value="critical_deadline">Critical deadline</option>
                    <option value="missing_evidence">Missing evidence</option>
                    <option value="client_response">Client response</option>
                    <option value="appointment_follow_up">Appointment</option>
                    <option value="invoice_follow_up">Invoice follow-up</option>
                    <option value="review_required">Review required</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Matter</span>
                  <select value={form.matterId} onChange={(event) => setForm((current) => ({ ...current, matterId: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white" disabled={Boolean(props.initialMatterId)}>
                    <option value="">No linked matter</option>
                    {props.matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Owner</span>
                  <select value={form.assignedToUserId} onChange={(event) => setForm((current) => ({ ...current, assignedToUserId: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-white">
                    <option value="">Unassigned</option>
                    {props.users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email || "Workspace user"}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                  <span className="font-medium text-white">Review required</span>
                  <div className="mt-3 flex items-center gap-2">
                    <input type="checkbox" checked={form.reviewRequired} onChange={(event) => setForm((current) => ({ ...current, reviewRequired: event.target.checked }))} />
                    <span>Keep this deadline flagged for agent review</span>
                  </div>
                </label>
                <label className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                  <span className="font-medium text-white">Client-safe visibility</span>
                  <div className="mt-3 flex items-center gap-2">
                    <input type="checkbox" checked={form.clientVisible} onChange={(event) => setForm((current) => ({ ...current, clientVisible: event.target.checked }))} />
                    <span>Use only generic wording in portal-facing reminders</span>
                  </div>
                </label>
              </div>
            </div>

            <GradientButton onClick={() => void saveDeadline()} className="h-11 rounded-2xl px-5" disabled={busy}>
              {editingId ? "Save deadline" : "Create deadline"}
            </GradientButton>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Reminder preview</h3>
            {preview ? (
              <div className="space-y-3 rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="info">{preview.preview.channel}</StatusPill>
                  <StatusPill tone={preview.item.clientFacing ? "warning" : "success"}>{preview.item.clientFacing ? "Client-safe" : "Agent alert"}</StatusPill>
                </div>
                {preview.preview.subject ? <p className="text-sm text-white">Subject: {preview.preview.subject}</p> : null}
                <p className="text-sm leading-6 text-slate-300">{preview.preview.body}</p>
                {preview.preview.blockedReason ? <p className="text-sm text-amber-200">{preview.preview.blockedReason}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <GradientButton onClick={() => void sendReminder()} className="h-10 rounded-2xl px-4" disabled={busy || Boolean(preview.preview.blockedReason)}>
                    Send reminder
                  </GradientButton>
                  <SubtleButton onClick={() => setPreview(null)} className="h-10 rounded-2xl px-4" disabled={busy}>
                    Close preview
                  </SubtleButton>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
                Open a deadline reminder preview to review the generic wording before sending it through safe portal, email, or agent-alert hooks.
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">History and audit</h3>
            <div className="space-y-3">
              {props.dashboard.history.length ? props.dashboard.history.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white">{event.eventType}</p>
                    <p className="text-xs text-slate-500">{formatDate(event.createdAt)}</p>
                  </div>
                  {event.summary ? <p className="mt-2 text-xs leading-5 text-slate-400">{event.summary}</p> : null}
                </div>
              )) : <p className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">No deadline history yet.</p>}
            </div>
            <div className="space-y-3">
              {props.dashboard.audit.length ? props.dashboard.audit.slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white">{event.action}</p>
                    <p className="text-xs text-slate-500">{formatDate(event.createdAt)}</p>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-400">{JSON.stringify(event.metadata, null, 2)}</pre>
                </div>
              )) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
