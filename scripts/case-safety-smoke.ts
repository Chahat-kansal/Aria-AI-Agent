import { assessMatterCaseSafety } from "@/lib/services/case-safety";

const matterId = process.argv[2];

if (!matterId) {
  console.error("Usage: npm exec tsx scripts/case-safety-smoke.ts <matterId>");
  process.exit(1);
}

async function main() {
  const result = await assessMatterCaseSafety(matterId);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
