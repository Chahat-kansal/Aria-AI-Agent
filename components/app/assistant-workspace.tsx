"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Send,
  Sparkles,
  X
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { GradientButton } from "@/components/ui/gradient-button";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";
import { cn } from "@/lib/utils";

type MatterOption = {
  id: string;
  label: string;
};

export type AssistantReply = {
  content: string;
  groundedFacts?: string[];
  reasoning?: string[];
  citations?: { label: string; href: string }[];
  recommendedActions?: string[];
  riskWarnings?: string[];
  reviewRequired?: boolean;
  setup?: string;
  configured?: boolean;
  error?: string;
  threadId?: string;
  threadTitle?: string;
  matterId?: string | null;
};

type PersistedMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  structuredJson?: unknown;
  citationsJson?: unknown;
  createdAt?: string | Date;
};

type PersistedThread = {
  id: string;
  title: string;
  matterId: string | null;
  createdAt?: string | Date;
  matter?: {
    id: string;
    visaSubclass?: string | null;
    title: string;
    client: {
      firstName: string;
      lastName: string;
    };
  } | null;
  messages: PersistedMessage[];
};

type ThreadMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
  payload?: Partial<AssistantReply> | null;
  pending?: boolean;
};

type ThreadState = {
  id: string;
  title: string;
  matterId: string | null;
  matterLabel?: string | null;
  createdAt?: string;
  messages: ThreadMessage[];
};

function normalizePayload(value: unknown): Partial<AssistantReply> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Partial<AssistantReply>;
}

function buildThreadState(thread: PersistedThread): ThreadState {
  return {
    id: thread.id,
    title: thread.title,
    matterId: thread.matterId ?? null,
    matterLabel: thread.matter ? `${thread.matter.client.firstName} ${thread.matter.client.lastName} - ${thread.matter.title}` : "Workspace-wide",
    createdAt: thread.createdAt ? new Date(thread.createdAt).toISOString() : undefined,
    messages: thread.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt ? new Date(message.createdAt).toISOString() : undefined,
      payload: message.role === "ASSISTANT" ? normalizePayload(message.structuredJson ?? message.citationsJson) : null
    }))
  };
}

function previewText(thread: ThreadState) {
  const assistantMessage = [...thread.messages].reverse().find((message) => message.role === "ASSISTANT");
  const userMessage = [...thread.messages].reverse().find((message) => message.role === "USER");
  return assistantMessage?.content ?? userMessage?.content ?? "No stored messages yet.";
}

function formatMessageTime(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function AssistantMessageBubble({ message }: { message: ThreadMessage }) {
  const isUser = message.role === "USER";
  const payload = message.payload;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-3xl rounded-[1.6rem] border px-5 py-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)]",
          isUser
            ? "border-cyan-400/20 bg-[linear-gradient(135deg,rgba(40,55,76,0.95),rgba(17,111,127,0.45))] text-slate-50"
            : "border-white/8 bg-[linear-gradient(180deg,rgba(14,17,24,0.98),rgba(11,15,23,0.94))] text-slate-200"
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-medium uppercase tracking-[0.22em]", isUser ? "text-cyan-200" : "text-cyan-300")}>
            {isUser ? "You" : message.role === "SYSTEM" ? "System" : "Aria"}
          </span>
          {message.createdAt ? <span className="text-[11px] text-slate-500">{formatMessageTime(message.createdAt)}</span> : null}
          {message.pending ? <span className="text-[11px] text-slate-500">Sending...</span> : null}
        </div>
        <div className="mt-3 whitespace-pre-wrap text-sm leading-7">{message.content}</div>

        {!isUser && payload ? (
          <div className="mt-4 space-y-4">
            {payload.setup ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">
                {payload.setup}
              </div>
            ) : null}
            {payload.error ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">
                {payload.error}
              </div>
            ) : null}
            {payload.groundedFacts?.length ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">Grounded facts</p>
                <ul className="mt-2 space-y-2">
                  {payload.groundedFacts.map((fact) => (
                    <li key={fact} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {payload.reasoning?.length ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">AI-assisted reasoning</p>
                <ul className="mt-2 space-y-2">
                  {payload.reasoning.map((item) => (
                    <li key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {payload.recommendedActions?.length ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">Recommended actions</p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {payload.recommendedActions.map((action) => (
                    <li key={action} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {payload.riskWarnings?.length ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">Risk warnings</p>
                <ul className="mt-2 space-y-2">
                  {payload.riskWarnings.map((warning) => (
                    <li key={warning} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-300">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {payload.citations?.length ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">Sources</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {payload.citations.map((citation) => (
                    <a
                      key={`${citation.label}-${citation.href}`}
                      href={citation.href}
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-white/[0.08]"
                    >
                      {citation.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {payload.reviewRequired ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-400">
                Aria is AI-assisted. Review required before actioning important migration advice.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AssistantWorkspace({
  matters,
  suggestions,
  initialThreads,
  aiConfigured,
  aiSetupMessage
}: {
  matters: MatterOption[];
  suggestions?: string[];
  initialThreads: PersistedThread[];
  aiConfigured: boolean;
  aiSetupMessage?: string | null;
}) {
  const [threads, setThreads] = useState<ThreadState[]>(() => initialThreads.map(buildThreadState));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreads[0]?.id ?? null);
  const [draftMessages, setDraftMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState(initialThreads[0]?.matterId ?? "");
  const [prompt, setPrompt] = useState("");
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [threadLoadError, setThreadLoadError] = useState<string | null>(null);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);

  const starterPrompts = suggestions?.length
    ? suggestions
    : [
      "Summarise the 189 vs 190 skilled visa distinction.",
      "Draft a client email about Form 80 updates.",
      "List 482 TSS nomination required documents.",
      "Explain partner visa relationship evidence tiers."
    ];

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );
  const visibleMessages = activeThread ? activeThread.messages : draftMessages;

  async function createThread(contextMatterId?: string) {
    const response = await fetch("/api/assistant/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contextType: contextMatterId ? "MATTER" : "WORKSPACE",
        contextId: contextMatterId || null
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.thread) {
      throw new Error(payload?.error ?? "Unable to start a new conversation right now.");
    }

    const thread = buildThreadState(payload.thread as PersistedThread);
    setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
    setActiveThreadId(thread.id);
    setSelectedMatterId(thread.matterId ?? "");
    setDraftMessages([]);
    return thread.id;
  }

  async function loadThread(threadId: string) {
    setThreadLoadError(null);
    const response = await fetch(`/api/assistant/threads/${threadId}`);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.thread) {
      const error = payload?.error ?? "Unable to load that conversation.";
      setThreadLoadError(error);
      throw new Error(error);
    }

    const thread = buildThreadState(payload.thread as PersistedThread);
    setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
    setActiveThreadId(thread.id);
    setSelectedMatterId(thread.matterId ?? "");
    return thread;
  }

  async function submitPrompt(nextPrompt: string) {
    const cleanedPrompt = nextPrompt.trim();
    if (!cleanedPrompt) return;

    const pendingUserMessage: ThreadMessage = {
      id: `pending-user-${Date.now()}`,
      role: "USER",
      content: cleanedPrompt,
      createdAt: new Date().toISOString(),
      pending: true
    };

    setIsLoading(true);
    setPrompt("");

    if (activeThreadId) {
      setThreads((current) =>
        current.map((thread) =>
          thread.id === activeThreadId
            ? { ...thread, messages: [...thread.messages, pendingUserMessage] }
            : thread
        )
      );
    } else {
      setDraftMessages((current) => [...current, pendingUserMessage]);
    }

    let targetThreadId = activeThreadId;
    if (!targetThreadId) {
      try {
        targetThreadId = await createThread(selectedMatterId || undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to start a new conversation.";
        const failedReply: ThreadMessage = {
          id: `assistant-error-${Date.now()}`,
          role: "ASSISTANT",
          content: message,
          createdAt: new Date().toISOString(),
          payload: { content: message, error: message, reviewRequired: true }
        };
        setDraftMessages((current) => [...current.filter((message) => !message.pending), pendingUserMessage, failedReply]);
        setIsLoading(false);
        return;
      }
    }

    const response = await fetch(`/api/assistant/threads/${targetThreadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: cleanedPrompt
      })
    });

    const payload = await response.json().catch(() => null);
    const reply: AssistantReply = response.ok
      ? payload
      : {
          ...payload,
          content: payload?.content ?? payload?.error ?? "Aria could not complete the request.",
          error: payload?.error
        };

    const threadId = typeof reply.threadId === "string" ? reply.threadId : targetThreadId;
    const matterId = typeof reply.matterId === "string" ? reply.matterId : selectedMatterId || null;
    const matterLabel = matters.find((matter) => matter.id === matterId)?.label ?? (matterId ? null : "Workspace-wide");
    const threadTitle =
      typeof reply.threadTitle === "string" && reply.threadTitle.trim()
        ? reply.threadTitle.trim()
        : cleanedPrompt.slice(0, 80);

    const userMessage: ThreadMessage = {
      id: `user-${Date.now()}`,
      role: "USER",
      content: cleanedPrompt,
      createdAt: new Date().toISOString()
    };
    const assistantMessage: ThreadMessage = {
      id: `assistant-${Date.now()}`,
      role: "ASSISTANT",
      content: reply.content,
      createdAt: new Date().toISOString(),
      payload: reply
    };

    if (threadId) {
      setThreads((current) => {
        const existing = current.find((thread) => thread.id === threadId);
        if (existing) {
          return [
            {
              ...existing,
              title: threadTitle,
              matterId,
              matterLabel,
              messages: [...existing.messages.filter((message) => !message.pending), userMessage, assistantMessage]
            },
            ...current.filter((thread) => thread.id !== threadId)
          ];
        }

        return [
          {
            id: threadId,
            title: threadTitle,
            matterId,
            matterLabel,
            createdAt: new Date().toISOString(),
            messages: [userMessage, assistantMessage]
          },
          ...current
        ];
      });
      setDraftMessages([]);
      setActiveThreadId(threadId);
    } else {
      setDraftMessages((current) => [...current.filter((message) => !message.pending), userMessage, assistantMessage]);
      setActiveThreadId(null);
    }
    setMobileRailOpen(false);
    setIsLoading(false);

    requestAnimationFrame(() => {
      if (messageViewportRef.current) {
        messageViewportRef.current.scrollTop = messageViewportRef.current.scrollHeight;
      }
    });
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPrompt(prompt);
  }

  function startNewConversation() {
    setPrompt("");
    setMobileRailOpen(false);
    void createThread().catch((error) => {
      setThreadLoadError(error instanceof Error ? error.message : "Unable to start a new conversation.");
    });
  }

  function selectThread(threadId: string) {
    setDraftMessages([]);
    setMobileRailOpen(false);
    void loadThread(threadId).catch(() => null);
  }

  const rail = (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-white/8 bg-[#070b11]/95 px-5 py-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <GradientButton type="button" onClick={startNewConversation} className="h-12 flex-1 justify-start gap-2 rounded-[1.5rem] px-5 text-slate-950">
            <Plus className="h-4 w-4" />
            New conversation
          </GradientButton>
          <button
            type="button"
            onClick={() => setMobileRailOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-slate-300 md:hidden"
            aria-label="Close conversations"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Recent</p>
        <div className="mt-4 space-y-2">
          {threads.length ? (
            threads.map((thread) => {
              const selected = thread.id === activeThreadId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={cn(
                    "w-full rounded-[1.35rem] border p-4 text-left transition",
                    selected
                      ? "border-cyan-400/20 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
                      : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn("truncate text-sm font-semibold", selected ? "text-white" : "text-slate-200")}>
                        {thread.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">{thread.matterLabel ?? "Workspace-wide"}</p>
                    </div>
                    <MessageSquare className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "text-cyan-300" : "text-slate-600")} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">{previewText(thread)}</p>
                </button>
              );
            })
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
              No conversations yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(7,9,13,0.98),rgba(10,12,17,0.97))] shadow-[0_28px_80px_rgba(0,0,0,0.35)]">
      <div className="grid min-h-[74vh] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          className={cn(
            "hidden min-h-[74vh] border-r border-white/8 bg-[#06090d]/96 lg:flex",
            railCollapsed ? "w-[96px]" : "w-full"
          )}
        >
          {railCollapsed ? (
            <div className="flex h-full w-full flex-col items-center gap-4 px-4 py-5">
              <button
                type="button"
                onClick={() => setRailCollapsed(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-slate-300"
                aria-label="Expand conversations"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={startNewConversation}
                className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-gradient-to-r from-violet-500 via-violet-400 to-cyan-400 text-slate-950 shadow-[0_14px_48px_rgba(34,211,238,0.22)]"
                aria-label="New conversation"
              >
                <Plus className="h-5 w-5" />
              </button>
              <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto pt-4">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => selectThread(thread.id)}
                    className={cn(
                      "inline-flex h-12 w-12 items-center justify-center rounded-[1rem] border transition",
                      thread.id === activeThreadId ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-300" : "border-white/8 bg-white/[0.03] text-slate-500 hover:text-slate-200"
                    )}
                    aria-label={thread.title}
                    title={thread.title}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="hidden items-center justify-end border-b border-white/8 px-5 py-4 lg:flex">
                <button
                  type="button"
                  onClick={() => setRailCollapsed(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-slate-300"
                  aria-label="Collapse conversations"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
              {rail}
            </div>
          )}
        </aside>

        {mobileRailOpen ? (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden">
            <div className="h-full max-w-[22rem] bg-[#06090d]/98 shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
              {rail}
            </div>
          </div>
        ) : null}

        <section className="relative flex min-h-[74vh] min-w-0 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">AI ASSISTANT</p>
              <h2 className="mt-2 font-serif text-3xl tracking-tight text-white sm:text-4xl">Ask Aria anything about your practice</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileRailOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-slate-300 lg:hidden"
                aria-label="Open conversations"
              >
                <Menu className="h-4 w-4" />
              </button>
              <StatusPill tone="info">Review required</StatusPill>
            </div>
          </div>

          <div ref={messageViewportRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
            {!aiConfigured && aiSetupMessage ? (
              <div className="mx-auto mb-6 max-w-4xl rounded-[1.4rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {aiSetupMessage}
              </div>
            ) : null}
            {visibleMessages.length ? (
              <div className="mx-auto flex max-w-4xl flex-col gap-4 pb-16">
                {activeThread?.matterLabel ? (
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">Conversation context</p>
                      <p className="mt-2 text-sm text-slate-400">{activeThread?.matterLabel}</p>
                    </div>
                    {activeThread?.matterId ? <StatusPill tone="info">Matter aware</StatusPill> : <StatusPill>Workspace</StatusPill>}
                  </div>
                ) : null}
                {visibleMessages.map((message) => (
                  <AssistantMessageBubble key={message.id} message={message} />
                ))}
                {isLoading ? (
                  <div className="flex justify-start">
                    <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(14,17,24,0.98),rgba(11,15,23,0.94))] px-5 py-4 text-sm text-slate-300">
                      Aria is reviewing the workspace context...
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-full items-center justify-center py-10">
                <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.8rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.32),transparent_55%),linear-gradient(180deg,rgba(10,28,31,0.95),rgba(18,20,30,0.98))] text-cyan-300 shadow-[0_18px_55px_rgba(34,211,238,0.16)]">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <p className="mt-6 text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">AI ASSISTANT</p>
                  <h3 className="mt-4 font-serif text-4xl tracking-tight text-white sm:text-5xl">How can Aria help today?</h3>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-slate-400">
                    Draft client letters, explain visa subclasses, summarise policy updates, or review evidence.
                  </p>
                  <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
                    {starterPrompts.map((starterPrompt) => (
                      <button
                        key={starterPrompt}
                        type="button"
                        onClick={() => {
                          setPrompt(starterPrompt);
                          void submitPrompt(starterPrompt);
                        }}
                        className="rounded-[1.6rem] border border-white/8 bg-white/[0.02] px-5 py-5 text-left text-base leading-7 text-slate-200 transition hover:bg-white/[0.05]"
                      >
                        {starterPrompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-white/8 bg-[linear-gradient(180deg,rgba(8,10,14,0.62),rgba(8,10,14,0.96))] px-5 pb-5 pt-4 backdrop-blur-xl sm:px-6">
            <form onSubmit={ask} className="mx-auto max-w-4xl">
              <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.03] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
                  <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Context</label>
                  <select
                    name="matterId"
                    value={selectedMatterId}
                    onChange={(event) => setSelectedMatterId(event.target.value)}
                    disabled={Boolean(activeThreadId)}
                    className="h-10 min-w-[180px] rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
                  >
                    <option value="">Workspace mode</option>
                    {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.label}</option>)}
                  </select>
                  {activeThreadId ? <span className="text-xs text-slate-500">Start a new conversation to change context.</span> : null}
                </div>
                <div className="flex items-end gap-3">
                  <textarea
                    name="prompt"
                    required
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (!isLoading && prompt.trim()) {
                          void submitPrompt(prompt);
                        }
                      }
                    }}
                    rows={1}
                    placeholder="Message Aria..."
                    className="min-h-[52px] flex-1 resize-none rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
                  />
                  <GradientButton type="submit" disabled={isLoading || !prompt.trim()} className="h-[52px] w-[52px] rounded-[1.2rem] px-0">
                    <Send className="h-4 w-4" />
                  </GradientButton>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Aria is AI-assisted. Review required before actioning important migration advice.
              </p>
              {threadLoadError ? <p className="mt-2 text-xs text-red-300">{threadLoadError}</p> : null}
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
