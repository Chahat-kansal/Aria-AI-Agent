import { auditEvent } from "@/lib/services/audit";

export function estimateAiCostUsd(input: { inputChars: number; outputChars?: number; provider: string }) {
  const units = input.inputChars + (input.outputChars || 0);
  const rate = input.provider === "anthropic" ? 0.000006 : 0.000004;
  return Number((units * rate).toFixed(6));
}

export async function recordAiUsage(input: {
  workspaceId?: string;
  userId?: string;
  task: string;
  provider: string;
  inputChars: number;
  outputChars?: number;
  success: boolean;
  error?: string | null;
}) {
  if (!input.workspaceId || !input.userId) return;
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "AI",
    entityId: input.task,
    action: input.success ? "provider.ai.test_success" : "provider.ai.test_failed",
    metadata: {
      provider: input.provider,
      estimatedCostUsd: estimateAiCostUsd({
        inputChars: input.inputChars,
        outputChars: input.outputChars,
        provider: input.provider
      }),
      reason: input.error || undefined
    }
  });
}
