import { runAiTask } from "@/lib/services/ai/provider-router";

type AriaAiInput = {
  system: string;
  user: string;
  context?: unknown;
};

export async function generateAriaAiResponse(input: AriaAiInput) {
  return runAiTask({
    task: "generic",
    system: input.system,
    user: input.user,
    context: input.context
  });
}
