import { listImmigrationSources } from "@/lib/data/immigration-source-registry";
import { buildLocalRegistrySnapshots, fetchSource } from "@/lib/services/immigration-source-ingestion";
import { discoverVisaSubclassesFromOfficialSource, writeDiscoveredVisaSubclasses } from "@/lib/services/visa-subclass-discovery";

async function main() {
  const sources = listImmigrationSources();
  const sampled = await Promise.all(sources.slice(0, 4).map((source) => fetchSource(source)));
  const discovery = await discoverVisaSubclassesFromOfficialSource();
  const outputPath = await writeDiscoveredVisaSubclasses(discovery);
  const snapshots = await buildLocalRegistrySnapshots();
  console.log(JSON.stringify({
    sourceCount: sources.length,
    sampleFetches: sampled.map((item) => ({
      sourceId: item.source.sourceId,
      ok: item.ok,
      httpStatus: item.httpStatus ?? null,
      error: item.error ?? null
    })),
    discovery: {
      totalDiscovered: discovery.totalDiscovered,
      alreadyMapped: discovery.alreadyMapped,
      missingDefinitions: discovery.missingDefinitions,
      closedOrUncertain: discovery.closedOrUncertain,
      warnings: discovery.warnings
    },
    snapshots,
    outputPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
