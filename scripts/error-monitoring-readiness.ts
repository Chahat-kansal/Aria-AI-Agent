import { getErrorMonitoringProviderStatus } from "@/lib/providers/error-monitoring-provider";

async function main() {
  const status = getErrorMonitoringProviderStatus();
  console.log(JSON.stringify({
    pass: true,
    provider: status.providerName,
    configured: status.configured,
    missing: status.missingEnv,
    notes: status.notes
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
