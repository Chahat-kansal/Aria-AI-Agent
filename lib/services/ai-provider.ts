type AriaAiInput = {
  system: string;
  user: string;
  context?: unknown;
};

export async function generateAriaAiResponse(input: AriaAiInput) {
  const provider = process.env.AI_PROVIDER || "openai";

  if (provider !== "openai") {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error("OpenAI returned no content");

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
