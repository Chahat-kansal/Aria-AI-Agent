export type AiTask =
  | "ask_aria"
  | "draft_autofill"
  | "full_draft_generation"
  | "pathway_analysis"
  | "source_summary"
  | "document_extraction"
  | "client_message_draft"
  | "generic";

export function buildSafeSystemPrompt(task: AiTask, system: string) {
  const rules = [
    "Use evidence-only context supplied by Aria.",
    "Do not provide final legal advice.",
    "Do not guarantee visa outcomes.",
    "Do not claim readiness to lodge.",
    "Use the phrase Ready for agent final review when appropriate.",
    "Do not use cross-matter or cross-client data.",
    "Do not reproduce full official document text unless explicitly approved for full review."
  ];

  if (task === "document_extraction") {
    rules.push("Do not invent fields. Return low confidence and review warnings if the source is weak.");
  }
  if (task === "client_message_draft") {
    rules.push("Draft only polite follow-up wording and avoid sensitive facts in channels like SMS or email.");
  }

  return `${rules.join("\n")}\n\n${system}`;
}
