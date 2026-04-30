type AriaAiInput = {
  system: string;
  user: string;
  context?: unknown;
};

const AI_TIMEOUT_MS = Math.max(5000, Number(process.env.AI_TIMEOUT_MS || 30000));

async function parseJsonResponse(res: Response) {
  const data = await res.json();
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

export async function generateAriaAiResponse(input: AriaAiInput) {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing");

    const res = await postJson("https://api.anthropic.com/v1/messages", {
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
        system: input.system,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              question: input.user,
              context: input.context ?? {}
            })
          }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic failed: ${res.status} ${text}`);
    }

    return parseJsonResponse(res);
  }

  if (provider !== "openai") {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const res = await postJson("https://api.openai.com/v1/chat/completions", {
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
        {
          role: "system",
          content: input.system
        },
        {
          role: "user",
          content: JSON.stringify({
            question: input.user,
            context: input.context ?? {}
          })
        }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI failed: ${res.status} ${text}`);
  }

  return parseJsonResponse(res);
}
