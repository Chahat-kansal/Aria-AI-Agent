import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret } from "@/lib/providers/shared";

export function getAiProviderStatus(): ProviderStatus {
  const provider = (process.env.AI_PROVIDER || "disabled").trim().toLowerCase();
  const configured =
    (provider === "openai" && hasConfiguredSecret(process.env.OPENAI_API_KEY)) ||
    (provider === "anthropic" && hasConfiguredSecret(process.env.ANTHROPIC_API_KEY));

  return buildProviderStatus({
    key: "ai",
    label: "AI",
    providerName: provider,
    configured,
    state: provider === "disabled" ? "disabled" : configured ? "configured" : "not_configured",
    missingEnv: configured ? [] : provider === "anthropic" ? ["ANTHROPIC_API_KEY"] : provider === "openai" ? ["OPENAI_API_KEY"] : ["AI_PROVIDER"],
    requiredSetupSteps: configured ? [] : ["Choose AI_PROVIDER.", "Add provider credentials before enabling live AI tasks."],
    notes: [
      "AI output stays review-required and evidence-scoped.",
      "Aria must not provide final legal advice or guarantee outcomes."
    ],
    disabledReason: provider === "disabled" ? "AI calls are disabled in this environment." : null
  });
}
