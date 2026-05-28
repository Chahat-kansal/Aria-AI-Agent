import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getPaymentProviderStatus(): ProviderStatus {
  const configured =
    hasConfiguredSecret(process.env.STRIPE_SECRET_KEY) &&
    hasConfiguredSecret(process.env.STRIPE_WEBHOOK_SECRET) &&
    hasConfiguredValue(process.env.STRIPE_PRICE_ID_STARTER) &&
    hasConfiguredValue(process.env.STRIPE_PRICE_ID_PRO) &&
    hasConfiguredValue(process.env.STRIPE_PRICE_ID_TEAM) &&
    hasConfiguredValue(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  return buildProviderStatus({
    key: "payments",
    label: "Payments",
    providerName: configured ? "stripe" : "not configured",
    configured,
    state: configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : [
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
          "STRIPE_PRICE_ID_STARTER",
          "STRIPE_PRICE_ID_PRO",
          "STRIPE_PRICE_ID_TEAM",
          "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
        ],
    requiredSetupSteps: configured ? [] : ["Configure Stripe keys and plan price IDs.", "Verify webhook signature handling before live billing."],
    notes: [
      "This provider is for Aria SaaS subscriptions only, not migration-agent client invoices.",
      "Webhook signature verification is required before live billing claims."
    ]
  });
}
