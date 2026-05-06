import { syncOfficialForms } from "../lib/services/official-forms-sync";

const workspaceId = process.argv[2];
const userId = process.argv[3];

if (!workspaceId || !userId) {
  console.error("Usage: npx tsx scripts/forms-sync-smoke.ts <workspaceId> <userId>");
  process.exit(1);
}

async function main() {
  const result = await syncOfficialForms({ workspaceId, userId });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
