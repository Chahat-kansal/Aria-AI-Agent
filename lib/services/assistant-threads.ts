import { AssistantRunStatus, AssistantThreadStatus, AssistantContextType, ChatRole, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAssistantContextPack, type AssistantScopedUser } from "@/lib/services/assistant-context";
import { generateAriaAiResponse } from "@/lib/services/ai-provider";
import { aiNotConfiguredResponse, isAiConfigured } from "@/lib/services/ai-config";
import { auditAccessDenied, auditEvent } from "@/lib/services/audit";
import { serverLog } from "@/lib/services/runtime-config";
import { canAccessMatter, scopedMatterWhere } from "@/lib/services/roles";

type ThreadUser = AssistantScopedUser;

const ASSISTANT_SYSTEM_PROMPT = `
You are Aria, an AI operating assistant for Australian migration practices.

You help with:
- matter status summaries
- missing evidence and checklist gaps
- client follow-up drafting
- visa subclass and pathway considerations
- validation blocker review
- final review preparation
- migration intelligence and update impact review
- invoice wording when visible billing data exists

Rules:
- Use only the supplied workspace context and cited sources.
- Never invent client facts, document contents, fees, or outcomes.
- Never guarantee a visa outcome.
- Never provide final legal advice.
- Never imply applications can be lodged automatically.
- Always say review is required.

Return strict JSON only:
{
  "content": string,
  "groundedFacts": string[],
  "reasoning": string[],
  "recommendedActions": string[],
  "citations": [{"label": string, "href": string}],
  "riskWarnings": string[],
  "reviewRequired": true
}
`.trim();

type NormalizedAssistantPayload = {
  content: string;
  groundedFacts: string[];
  reasoning: string[];
  recommendedActions: string[];
  citations: Array<{ label: string; href: string }>;
  riskWarnings: string[];
  reviewRequired: true;
  configured?: boolean;
  setup?: string;
  error?: string;
};

function normalizeReply(value: any, fallback: NormalizedAssistantPayload): NormalizedAssistantPayload {
  return {
    content: typeof value?.content === "string" && value.content.trim() ? value.content.trim() : fallback.content,
    groundedFacts: Array.isArray(value?.groundedFacts) ? value.groundedFacts.map(String).slice(0, 12) : fallback.groundedFacts,
    reasoning: Array.isArray(value?.reasoning) ? value.reasoning.map(String).slice(0, 12) : fallback.reasoning,
    recommendedActions: Array.isArray(value?.recommendedActions) ? value.recommendedActions.map(String).slice(0, 12) : fallback.recommendedActions,
    citations: Array.isArray(value?.citations)
      ? value.citations
          .filter((citation: any) => citation && typeof citation.label === "string" && typeof citation.href === "string")
          .slice(0, 12)
      : fallback.citations,
    riskWarnings: Array.isArray(value?.riskWarnings) ? value.riskWarnings.map(String).slice(0, 12) : fallback.riskWarnings,
    reviewRequired: true,
    configured: typeof value?.configured === "boolean" ? value.configured : fallback.configured,
    setup: typeof value?.setup === "string" ? value.setup : fallback.setup,
    error: typeof value?.error === "string" ? value.error : fallback.error
  };
}

function summarizeContextForFallback(contextPack: any): NormalizedAssistantPayload {
  const groundedFacts: string[] = [];
  const reasoning: string[] = [];
  const recommendedActions: string[] = [];
  const citations: Array<{ label: string; href: string }> = [];
  const riskWarnings: string[] = [];

  if (contextPack.scope === "matter" && contextPack.contextStatus === "ok") {
    groundedFacts.push(
      `Matter ${contextPack.matter.title} is in ${String(contextPack.matter.stage).toLowerCase().replace(/_/g, " ")} with readiness ${contextPack.matter.readinessScore}%.`,
      `Client: ${contextPack.matter.client.name}.`,
      `Open draft or validation blockers: ${contextPack.draftReview.openIssues.length}.`,
      `Checklist gaps visible: ${contextPack.checklistGaps.length}.`,
      `Document requests visible: ${contextPack.documentRequests.length}.`,
      `Relevant update impacts: ${contextPack.updateImpacts.length}.`
    );
    reasoning.push(
      contextPack.draftReview.openIssues.length
        ? "The stored draft and validation data show unresolved review items."
        : "No stored open validation issue is visible, but source review is still required.",
      contextPack.checklistGaps.length
        ? "Missing checklist evidence should be resolved before client-facing readiness claims."
        : "Checklist links do not currently show missing evidence in this scope.",
      contextPack.updateImpacts.length
        ? "Recent migration intelligence may change matter assumptions and should be reviewed."
        : "No active migration intelligence impact is currently linked to this matter."
    );
    recommendedActions.push(
      ...contextPack.matterIntelligence.recommendedActions.map((action: any) => action.title ?? action.reason ?? String(action)).slice(0, 5)
    );
    citations.push(
      { label: "Matter", href: `/app/matters/${contextPack.matter.id}` },
      { label: "Draft review", href: `/app/matters/${contextPack.matter.id}/draft` },
      { label: "Checklist", href: `/app/matters/${contextPack.matter.id}/checklist` }
    );
    riskWarnings.push(...(contextPack.matterIntelligence.securityWarnings ?? []).slice(0, 5));
  } else if (contextPack.scope === "workspace" && contextPack.contextStatus === "ok") {
    groundedFacts.push(
      `Visible matters: ${contextPack.matters.length}.`,
      `Open document requests in scope: ${contextPack.documentRequests.length}.`,
      `Upcoming appointments in scope: ${contextPack.appointments.length}.`,
      `Recent migration intelligence items visible: ${contextPack.updates.length}.`,
      `Recent pathway analyses visible: ${contextPack.pathwayAnalyses.length}.`
    );
    reasoning.push(
      `Aria daily briefing urgency is ${String(contextPack.workspace.briefing.urgency).toLowerCase()}.`,
      contextPack.workspace.security?.warnings?.length
        ? "Security and access warnings are present for this workspace scope."
        : "No additional security warnings were surfaced for this scope."
    );
    recommendedActions.push(
      ...contextPack.workspace.nextActions.map((action: any) => action.title ?? action.reason ?? String(action)).slice(0, 6)
    );
    citations.push(
      { label: "Overview", href: "/app/overview" },
      { label: "Updates", href: "/app/updates" },
      { label: "Assistant", href: "/app/assistant" }
    );
    riskWarnings.push(...(contextPack.workspace.security?.warnings ?? []).slice(0, 5));
  } else {
    groundedFacts.push("The selected context is not currently available within your workspace scope.");
    reasoning.push("Aria cannot safely infer missing workspace data.");
  }

  return {
    content: "Aria prepared a grounded workspace summary from the currently accessible records. Review required before acting on any migration advice or client-facing wording.",
    groundedFacts,
    reasoning,
    recommendedActions,
    citations,
    riskWarnings: riskWarnings.length ? riskWarnings : ["Aria is AI-assisted. Registered migration agent review remains required."],
    reviewRequired: true
  };
}

async function assertThreadAccess(threadId: string, user: ThreadUser) {
  const thread = await prisma.aiChatThread.findFirst({
    where: {
      id: threadId,
      workspaceId: user.workspaceId,
      createdByUserId: user.id
    },
    include: {
      matter: {
        select: {
          id: true,
          workspaceId: true,
          assignedToUserId: true,
          assignedToUser: { select: { supervisorId: true } }
        }
      }
    }
  });

  if (!thread) return null;
  if (thread.matter && !canAccessMatter(user, thread.matter)) return null;
  return thread;
}

export async function listAssistantThreadsForUser(user: ThreadUser) {
  return prisma.aiChatThread.findMany({
    where: {
      workspaceId: user.workspaceId,
      createdByUserId: user.id,
      status: AssistantThreadStatus.ACTIVE
    },
    include: {
      matter: { include: { client: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 48 }
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }]
  });
}

export async function getAssistantThreadForUser(threadId: string, user: ThreadUser) {
  const thread = await assertThreadAccess(threadId, user);
  if (!thread) return null;

  return prisma.aiChatThread.findFirst({
    where: { id: threadId, workspaceId: user.workspaceId, createdByUserId: user.id },
    include: {
      matter: { include: { client: true } },
      messages: { orderBy: { createdAt: "asc" } }
    }
  });
}

export async function createAssistantThreadForUser(input: {
  user: ThreadUser;
  title?: string | null;
  contextType?: AssistantContextType | null;
  contextId?: string | null;
}) {
  const contextType = input.contextType ?? AssistantContextType.WORKSPACE;
  const contextId = input.contextId ?? null;
  let matterId: string | null = null;

  if (contextType === AssistantContextType.MATTER && contextId) {
    const matter = await prisma.matter.findFirst({
      where: { id: contextId, ...scopedMatterWhere(input.user) },
      select: {
        id: true,
        workspaceId: true,
        assignedToUserId: true,
        assignedToUser: { select: { supervisorId: true } }
      }
    });

    if (!matter || !canAccessMatter(input.user, matter)) {
      await auditAccessDenied({
        workspaceId: input.user.workspaceId,
        userId: input.user.id,
        entityType: "AssistantThread",
        entityId: contextId,
        reason: "Matter context denied during assistant thread creation."
      });
      throw new Error("You do not have access to that matter context.");
    }

    matterId = matter.id;
  }

  const thread = await prisma.aiChatThread.create({
    data: {
      workspaceId: input.user.workspaceId,
      createdByUserId: input.user.id,
      title: input.title?.trim() || "New conversation",
      contextType,
      contextId,
      matterId,
      status: AssistantThreadStatus.ACTIVE,
      lastMessageAt: new Date()
    }
  });

  await auditEvent({
    workspaceId: input.user.workspaceId,
    userId: input.user.id,
    entityType: "AssistantThread",
    entityId: thread.id,
    action: "assistant.thread.created",
    metadata: {
      contextType,
      contextId,
      matterId
    }
  });

  return thread;
}

export async function archiveAssistantThreadForUser(input: {
  threadId: string;
  user: ThreadUser;
}) {
  const thread = await assertThreadAccess(input.threadId, input.user);
  if (!thread) return null;

  const updated = await prisma.aiChatThread.update({
    where: { id: input.threadId },
    data: { status: AssistantThreadStatus.ARCHIVED }
  });

  await auditEvent({
    workspaceId: input.user.workspaceId,
    userId: input.user.id,
    entityType: "AssistantThread",
    entityId: input.threadId,
    action: "assistant.thread.archived"
  });

  return updated;
}

export async function updateAssistantThreadForUser(input: {
  threadId: string;
  user: ThreadUser;
  title?: string | null;
  status?: AssistantThreadStatus | null;
}) {
  const thread = await assertThreadAccess(input.threadId, input.user);
  if (!thread) return null;

  const updated = await prisma.aiChatThread.update({
    where: { id: input.threadId },
    data: {
      title: input.title?.trim() ? input.title.trim() : undefined,
      status: input.status ?? undefined
    }
  });

  await auditEvent({
    workspaceId: input.user.workspaceId,
    userId: input.user.id,
    entityType: "AssistantThread",
    entityId: input.threadId,
    action: "assistant.thread.updated",
    metadata: {
      title: input.title ?? null,
      status: input.status ?? null
    }
  });

  return updated;
}

export async function sendAssistantThreadMessage(input: {
  threadId: string;
  prompt: string;
  user: ThreadUser;
}) {
  const thread = await assertThreadAccess(input.threadId, input.user);
  if (!thread) {
    await auditAccessDenied({
      workspaceId: input.user.workspaceId,
      userId: input.user.id,
      entityType: "AssistantThread",
      entityId: input.threadId,
      reason: "Thread access denied during message send."
    });
    throw new Error("That conversation is no longer available.");
  }

  const prompt = input.prompt.trim().slice(0, 4000);
  if (!prompt) throw new Error("A prompt is required.");

  const run = await prisma.assistantRun.create({
    data: {
      threadId: thread.id,
      workspaceId: input.user.workspaceId,
      userId: input.user.id,
      status: AssistantRunStatus.PENDING,
      inputJson: {
        prompt,
        contextType: thread.contextType ?? "WORKSPACE",
        contextId: thread.contextId ?? null,
        matterId: thread.matterId ?? null
      }
    }
  });

  const userMessage = await prisma.aiChatMessage.create({
    data: {
      threadId: thread.id,
      workspaceId: input.user.workspaceId,
      userId: input.user.id,
      role: ChatRole.USER,
      content: prompt
    }
  });

  await prisma.aiChatThread.update({
    where: { id: thread.id },
    data: {
      title: thread.title === "New conversation" ? prompt.slice(0, 80) : thread.title,
      lastMessageAt: new Date()
    }
  });

  const contextPack = await buildAssistantContextPack({
    workspaceId: input.user.workspaceId,
    user: input.user,
    contextType: (thread.contextType ?? "WORKSPACE") as any,
    contextId: thread.contextId,
    matterId: thread.matterId
  });

  const fallback = summarizeContextForFallback(contextPack);
  let normalized: NormalizedAssistantPayload = fallback;
  let modelName: string | null = null;

  try {
    if (!isAiConfigured()) {
      normalized = {
        ...fallback,
        content: "AI is not configured. Add API key in environment variables to enable Aria responses.",
        configured: false,
        setup: aiNotConfiguredResponse().setup,
        citations: []
      };
    } else {
      const ai = await generateAriaAiResponse({
        system: ASSISTANT_SYSTEM_PROMPT,
        user: prompt,
        context: contextPack
      });
      modelName = process.env.AI_MODEL || process.env.OPENAI_MODEL || process.env.ANTHROPIC_MODEL || null;
      normalized = normalizeReply(ai, fallback);
    }

    const assistantMessage = await prisma.aiChatMessage.create({
      data: {
        threadId: thread.id,
        workspaceId: input.user.workspaceId,
        role: ChatRole.ASSISTANT,
        content: normalized.content,
        structuredJson: normalized as any,
        citationsJson: normalized.citations as any,
        model: modelName
      }
    });

    await prisma.assistantRun.update({
      where: { id: run.id },
      data: {
        status: AssistantRunStatus.COMPLETED,
        outputJson: normalized as any,
        completedAt: new Date()
      }
    });

    await prisma.aiChatThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: assistantMessage.createdAt,
        title: thread.title === "New conversation" ? prompt.slice(0, 80) : thread.title
      }
    });

    await auditEvent({
      workspaceId: input.user.workspaceId,
      userId: input.user.id,
      entityType: "AssistantThread",
      entityId: thread.id,
      action: "assistant.message.sent",
      metadata: {
        runId: run.id,
        contextType: thread.contextType ?? "WORKSPACE",
        contextId: thread.contextId ?? null
      }
    });

    await auditEvent({
      workspaceId: input.user.workspaceId,
      userId: input.user.id,
      entityType: "AssistantThread",
      entityId: thread.id,
      action: "assistant.response.generated",
      metadata: {
        runId: run.id,
        configured: normalized.configured ?? true
      }
    });

    return {
      threadId: thread.id,
      threadTitle: thread.title === "New conversation" ? prompt.slice(0, 80) : thread.title,
      contextType: thread.contextType ?? "WORKSPACE",
      contextId: thread.contextId ?? null,
      matterId: thread.matterId ?? null,
      userMessage,
      assistantMessage,
      payload: normalized
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown assistant error";
    serverLog("assistant.message_failed", { threadId: thread.id, error: message });

    await prisma.assistantRun.update({
      where: { id: run.id },
      data: {
        status: AssistantRunStatus.FAILED,
        errorMessage: message,
        completedAt: new Date()
      }
    });

    await auditEvent({
      workspaceId: input.user.workspaceId,
      userId: input.user.id,
      entityType: "AssistantThread",
      entityId: thread.id,
      action: "assistant.ai_failed",
      metadata: {
        runId: run.id,
        error: message
      }
    });

    throw error;
  }
}
