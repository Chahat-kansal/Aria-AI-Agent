import { listVisaSubclassCatalog } from "@/lib/data/visa-subclass-catalog";
import { listSubclassSupport } from "@/lib/services/subclass-support";
import { listVisaSubclassDefinitions } from "@/lib/services/visa-field-definitions";

async function main() {
  const catalog = listVisaSubclassCatalog();
  const definitions = listVisaSubclassDefinitions();
  const support = listSubclassSupport();
  const definitionMap = new Map(definitions.map((item) => [item.subclassCode, item]));
  const distribution = catalog.reduce((acc, item) => {
    acc[item.supportLevel] = (acc[item.supportLevel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const supportDistribution = support.reduce((acc, item) => {
    acc[item.supportLevel] = (acc[item.supportLevel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const discoveredButUnmapped = catalog.filter((item) => !definitionMap.has(item.normalizedCode) && !definitionMap.has(item.subclassCode));
  const topPriorityMissing = catalog.filter((item) => item.priority === "HIGH" && item.supportLevel !== "FULL_FIELD_AUTOFILL");
  const highlightedWorkflowCodes = ["858", "590", "300", "407", "494", "870", "47SP_40SP_888", "47CH_40CH_47PA_1229", "400", "403", "408", "462", "417", "771", "602"];
  const highlightedWorkflows = support
    .filter((item) => highlightedWorkflowCodes.includes(item.subclassCode))
    .map((item) => ({
      code: item.subclassCode,
      label: item.label,
      supportLevel: item.supportLevel,
      extractionSupport: item.extractionSupport,
      fullDraftSupport: item.fullDraftSupport,
      pdfFormFillingSupport: item.pdfFormFillingSupport,
      knownLimitations: item.knownLimitations
    }));

  console.log(JSON.stringify({
    totalSubclassDefinitions: definitions.length,
    totalRegistryRows: catalog.length,
    supportLevelDistribution: distribution,
    workflowTruthTableDistribution: supportDistribution,
    missingFromOfficialDiscovery: [],
    discoveredButUnmapped: discoveredButUnmapped.map((item) => item.normalizedCode),
    topPriorityMissing: topPriorityMissing.map((item) => ({
      code: item.normalizedCode,
      name: item.name,
      supportLevel: item.supportLevel
    })),
    highlightedWorkflows
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
