export type AiReply = {
  content: string;
  citations: { label: string; href: string }[];
  recommendedActions: string[];
};

export async function generateSeededAiReply(prompt: string): Promise<AiReply> {
  return {
    content: `AI-assisted draft for: ${prompt}. Review required prior to any lodgement action.`,
    citations: [
      { label: "Matter validation panel", href: "/app/validation" },
      { label: "Official update feed", href: "/app/updates" }
    ],
    recommendedActions: ["Review flagged inconsistencies", "Verify source-linked fields", "Confirm submission readiness checklist"]
  };
}
