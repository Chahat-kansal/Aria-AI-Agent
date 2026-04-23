export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.AI_PROVIDER);
}

export function aiNotConfiguredResponse() {
  return {
    error: "AI is not configured. Add API key in environment variables.",
    configured: false
  };
}
