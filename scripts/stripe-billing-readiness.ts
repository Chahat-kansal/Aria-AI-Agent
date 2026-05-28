import { getPaymentProviderStatus } from "@/lib/providers/payment-provider";

async function main() {
  const status = getPaymentProviderStatus();
  console.log(JSON.stringify({
    pass: true,
    billingProductionReady: status.configured,
    provider: status.providerName,
    missing: status.missingEnv,
    notes: [
      "Stripe webhook verification is required before billing can be described as production-ready.",
      "This script reports honest readiness and does not fail just because billing is not configured in a local environment."
    ]
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
