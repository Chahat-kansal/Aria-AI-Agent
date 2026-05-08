import { runMatterAutoprep, type AriaApprovalActionKey } from "@/lib/services/aria-autoprep";
import { prisma } from "@/lib/prisma";

const matterId = process.argv[2];
const validActions: AriaApprovalActionKey[] = [
  "generate_form_drafts",
  "generate_internal_drafts",
  "create_portal_link",
  "send_intake_request",
  "send_document_request"
];

const approvedActions = (process.argv[3] || "")
  .split(",")
  .map((value) => value.trim())
  .filter((value): value is AriaApprovalActionKey => validActions.includes(value as AriaApprovalActionKey));

if (!matterId) {
  console.error("Usage: npm exec tsx scripts/autoprep-smoke.ts <matterId> [approvedAction,approvedAction]");
  process.exit(1);
}

async function main() {
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: matterId } });

  const firstUser = await prisma.user.findFirst({
    where: { workspaceId: matter.workspaceId, status: { not: "DISABLED" } },
    orderBy: { id: "asc" }
  });

  if (!firstUser) {
    throw new Error("No active user found for this workspace.");
  }

  const preview = await runMatterAutoprep({
    matterId,
    workspaceId: matter.workspaceId,
    userId: firstUser.id,
    approvedActions
  });

  console.log(JSON.stringify({
    preview: {
      summary: preview.summary,
      executedActions: preview.executedActions,
      approvalCandidates: preview.approvalCandidates,
      approvedResults: preview.approvedResults,
      clientConfirmations: preview.clientConfirmations,
      hardBlockers: preview.safety.hardBlockers,
      softBlockers: preview.safety.softBlockers
    }
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
