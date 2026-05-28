import { buildSafeSystemPrompt, type AiTask } from "@/lib/services/ai/safety-guardrails";
import { recordAiUsage } from "@/lib/services/ai/cost-tracker";

type RouterInput = {
  task: AiTask;
  system: string;
  user: string;
  context?: unknown;
  workspaceId?: string;
  userId?: string;
};

const AI_TIMEOUT_MS = Math.max(5000, Number(process.env.AI_TIMEOUT_MS || 30000));

async function parseJsonResponse(res: Response) {
  let data: any;
  try {
    data = await res.json();
  } catch {
    const fallbackText = await res.text().catch(() => "");
    if (!fallbackText) throw new Error("AI provider returned an unreadable response body");
    try {
      return JSON.parse(fallbackText);
    } catch {
      return {
        content: fallbackText,
        groundedFacts: [],
        reasoning: [],
        recommendedActions: [],
        citations: [],
        riskWarnings: ["AI response body was not valid JSON. Agent review required."],
        reviewRequired: true
      };
    }
  }
  const content = data.choices?.[0]?.message?.content ?? data.content?.[0]?.text;
  if (!content) throw new Error("AI provider returned no content");
  try {
    return JSON.parse(content);
  } catch {
    return {
      content,
      groundedFacts: [],
      reasoning: [],
      recommendedActions: [],
      citations: [],
      riskWarnings: ["AI response was not valid JSON. Agent review required."],
      reviewRequired: true
    };
  }
}

async function postJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function withOneRetry<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out|aborted|no content|failed/i.test(message)) return fn();
    throw error;
  }
}

export async function runAiTask(input: RouterInput) {
  const provider = (process.env.AI_PROVIDER || "disabled").toLowerCase();
  if (provider === "disabled") {
    throw new Error("AI_PROVIDER is disabled");
  }

  const guardedSystem = buildSafeSystemPrompt(input.task, input.system);
  const userPayload = JSON.stringify({
    question: input.user,
    context: input.context ?? {}
  });

  try {
    if (provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing");

      const res = await withOneRetry(() => postJson("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "claude-3-5-sonnet-latest",
          max_tokens: 1400,
          temperature: 0.2,
          system: guardedSystem,
          messages: [{ role: "user", content: userPayload }]
        })
      }));
      if (!res.ok) throw new Error(`Anthropic failed: ${res.status} ${await res.text()}`);
      const parsed = await parseJsonResponse(res);
      await recordAiUsage({
        workspaceId: input.workspaceId,
        userId: input.userId,
        task: input.task,
        provider,
        inputChars: guardedSystem.length + userPayload.length,
        outputChars: JSON.stringify(parsed).length,
        success: true
      });
      return parsed;
    }

    if (provider !== "openai") {
      throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is missing");
    const res = await withOneRetry(() => postJson("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: guardedSystem },
          { role: "user", content: userPayload }
        ]
      })
    }));
    if (!res.ok) throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
    const parsed = await parseJsonResponse(res);
    await recordAiUsage({
      workspaceId: input.workspaceId,
      userId: input.userId,
      task: input.task,
      provider,
      inputChars: guardedSystem.length + userPayload.length,
      outputChars: JSON.stringify(parsed).length,
      success: true
    });
    return parsed;
  } catch (error) {
    await recordAiUsage({
      workspaceId: input.workspaceId,
      userId: input.userId,
      task: input.task,
      provider,
      inputChars: guardedSystem.length + userPayload.length,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
