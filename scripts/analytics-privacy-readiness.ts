import { getAnalyticsProviderStatus } from "@/lib/providers/analytics-provider";

async function main() {
  const status = getAnalyticsProviderStatus();
  console.log(JSON.stringify({
    pass: true,
    provider: status.providerName,
    configured: status.configured,
    missing: status.missingEnv,
    notes: [
      ...status.notes,
      "Analytics should be aggregated and product-focused only."
    ]
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
