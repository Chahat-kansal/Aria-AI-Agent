import { listVisaSubclassCatalog } from "@/lib/data/visa-subclass-catalog";
import { listVisaSubclassDefinitions } from "@/lib/services/visa-field-definitions";

async function main() {
  const catalog = listVisaSubclassCatalog();
  const definitions = listVisaSubclassDefinitions();
  const definitionMap = new Map(definitions.map((item) => [item.subclassCode, item]));
  const distribution = catalog.reduce((acc, item) => {
    acc[item.supportLevel] = (acc[item.supportLevel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const discoveredButUnmapped = catalog.filter((item) => !definitionMap.has(item.normalizedCode) && !definitionMap.has(item.subclassCode));
  const topPriorityMissing = catalog.filter((item) => item.priority === "HIGH" && item.supportLevel !== "FULL_FIELD_AUTOFILL");

  console.log(JSON.stringify({
    totalSubclassDefinitions: definitions.length,
    totalRegistryRows: catalog.length,
    supportLevelDistribution: distribution,
    missingFromOfficialDiscovery: [],
    discoveredButUnmapped: discoveredButUnmapped.map((item) => item.normalizedCode),
    topPriorityMissing: topPriorityMissing.map((item) => ({
      code: item.normalizedCode,
      name: item.name,
      supportLevel: item.supportLevel
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
