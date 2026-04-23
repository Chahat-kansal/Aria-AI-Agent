import { getAiConfigStatus } from "@/lib/services/runtime-config";

export function isAiConfigured() {
  return getAiConfigStatus().configured;
}

export function aiNotConfiguredResponse() {
  const status = getAiConfigStatus();
  return {
    error: "AI is not configured. Add API key in environment variables.",
    configured: false,
    setup: `Missing ${status.missing.join(", ")}. Set OPENAI_API_KEY or ANTHROPIC_API_KEY, then restart the deployment. Aria will not show fake AI output while the provider is missing.`
  };
}
