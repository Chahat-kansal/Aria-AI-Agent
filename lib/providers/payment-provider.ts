import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export type PaymentProviderName = "stripe" | "disabled";

export type PaymentProviderEnv = {
  provider: PaymentProviderName;
  configured: boolean;
  stripeSecretKeyPresent: boolean;
  webhookSecretPresent: boolean;
  publishableKeyPresent: boolean;
  priceIdsPresent: {
    starter: boolean;
    pro: boolean;
    team: boolean;
  };
  successUrlPresent: boolean;
  cancelUrlPresent: boolean;
  missingEnv: string[];
};

function getPaymentProviderName(): PaymentProviderName {
  return (process.env.PAYMENT_PROVIDER || "disabled").trim().toLowerCase() === "stripe" ? "stripe" : "disabled";
}

export function getPaymentProviderEnv(): PaymentProviderEnv {
  const provider = getPaymentProviderName();
  const stripeSecretKeyPresent = hasConfiguredSecret(process.env.STRIPE_SECRET_KEY);
  const webhookSecretPresent = hasConfiguredSecret(process.env.STRIPE_WEBHOOK_SECRET);
  const publishableKeyPresent = hasConfiguredSecret(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const priceIdsPresent = {
    starter: hasConfiguredValue(process.env.STRIPE_PRICE_ID_STARTER),
    pro: hasConfiguredValue(process.env.STRIPE_PRICE_ID_PRO),
    team: hasConfiguredValue(process.env.STRIPE_PRICE_ID_TEAM)
  };
  const successUrlPresent = hasConfiguredValue(process.env.STRIPE_SUCCESS_URL);
  const cancelUrlPresent = hasConfiguredValue(process.env.STRIPE_CANCEL_URL);

  const configured = provider === "stripe"
    && stripeSecretKeyPresent
    && webhookSecretPresent
    && publishableKeyPresent
    && priceIdsPresent.starter
    && priceIdsPresent.pro
    && priceIdsPresent.team
    && successUrlPresent
    && cancelUrlPresent;

  const missingEnv = provider === "disabled"
    ? []
    : [
        !stripeSecretKeyPresent ? "STRIPE_SECRET_KEY" : null,
        !webhookSecretPresent ? "STRIPE_WEBHOOK_SECRET" : null,
        !publishableKeyPresent ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" : null,
        !priceIdsPresent.starter ? "STRIPE_PRICE_ID_STARTER" : null,
        !priceIdsPresent.pro ? "STRIPE_PRICE_ID_PRO" : null,
        !priceIdsPresent.team ? "STRIPE_PRICE_ID_TEAM" : null,
        !successUrlPresent ? "STRIPE_SUCCESS_URL" : null,
        !cancelUrlPresent ? "STRIPE_CANCEL_URL" : null
      ].filter(Boolean) as string[];

  return {
    provider,
    configured,
    stripeSecretKeyPresent,
    webhookSecretPresent,
    publishableKeyPresent,
    priceIdsPresent,
    successUrlPresent,
    cancelUrlPresent,
    missingEnv
  };
}

export function getPaymentProviderStatus(): ProviderStatus {
  const env = getPaymentProviderEnv();
  if (env.provider === "disabled") {
    return buildProviderStatus({
      key: "payments",
      label: "Payments",
      providerName: "disabled",
      configured: false,
      state: "disabled",
      missingEnv: ["PAYMENT_PROVIDER"],
      requiredSetupSteps: [
        "Choose PAYMENT_PROVIDER=stripe.",
        "Add Stripe test or live keys, price IDs, and webhook secret before creating billing sessions."
      ],
      notes: [
        "This provider is for Aria SaaS subscriptions first, with optional invoice payments kept separate.",
        "Webhook signature verification is required before live billing claims."
      ],
      disabledReason: "Payments are disabled until Stripe is configured."
    });
  }

  return buildProviderStatus({
    key: "payments",
    label: "Payments",
    providerName: "stripe",
    configured: env.configured,
    state: env.configured ? "configured" : "not_configured",
    missingEnv: env.missingEnv,
    requiredSetupSteps: env.configured
      ? []
      : [
          "Set PAYMENT_PROVIDER=stripe.",
          "Configure Stripe secret key, publishable key, webhook secret, and plan price IDs.",
          "Verify webhook signature handling before live billing."
        ],
    notes: [
      "This provider is for Aria SaaS subscriptions only unless invoice payments are explicitly enabled.",
      "No card numbers, CVCs, or full payment method details are stored in Aria."
    ]
  });
}
