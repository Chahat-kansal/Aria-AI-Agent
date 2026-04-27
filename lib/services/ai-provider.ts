type AiInput = {
  system: string;
  user: string;
  context?: unknown;
};

export async function generateAriaAiResponse(input: AiInput) {
  if ((process.env.AI_PROVIDER || "openai") !== "openai") {
    throw new Error("Only OpenAI is manually implemented right now.");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
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
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error("OpenAI returned no content");

  return JSON.parse(content);
}