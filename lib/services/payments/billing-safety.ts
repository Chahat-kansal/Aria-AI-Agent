import { BillingPlan } from "@prisma/client";

export type WorkspaceCheckoutMetadata = {
  workspaceId: string;
  plan: BillingPlan;
  environment: string;
  internalBillingCustomerId: string;
};

export type InvoicePaymentMetadata = {
  workspaceId: string;
  invoiceId: string;
  invoiceNumber: string;
};

const forbiddenPatterns = [
  /passport/i,
  /\bdob\b/i,
  /date of birth/i,
  /grant/i,
  /document/i,
  /visa/i,
  /health/i,
  /character/i,
  /client name/i,
  /notes/i,
  /tokenhash/i,
  /token/i,
  /https?:\/\//i
];

function isSafeValue(value: string) {
  return !forbiddenPatterns.some((pattern) => pattern.test(value));
}

export function buildWorkspaceCheckoutMetadata(input: {
  workspaceId: string;
  plan: BillingPlan;
  environment?: string | null;
}) {
  const metadata: WorkspaceCheckoutMetadata = {
    workspaceId: input.workspaceId,
    plan: input.plan,
    environment: (input.environment || process.env.NODE_ENV || "development").toLowerCase(),
    internalBillingCustomerId: `${input.workspaceId}:${input.plan}`.slice(0, 80)
  };

  assertSafeStripeMetadata(metadata);
  return metadata;
}

export function buildInvoicePaymentMetadata(input: {
  workspaceId: string;
  invoiceId: string;
  invoiceNumber: string;
}) {
  const metadata: InvoicePaymentMetadata = {
    workspaceId: input.workspaceId,
    invoiceId: input.invoiceId,
    invoiceNumber: input.invoiceNumber
  };

  assertSafeStripeMetadata(metadata);
  return metadata;
}

export function assertSafeStripeMetadata(metadata: Record<string, string | BillingPlan>) {
  for (const [key, value] of Object.entries(metadata)) {
    if (!isSafeValue(key) || !isSafeValue(String(value))) {
      throw new Error("Sensitive data cannot be placed into Stripe metadata.");
    }
  }
}

export function getStripePlanCatalog() {
  return [
    {
      plan: BillingPlan.STARTER,
      label: "Starter",
      description: "Solo or early-stage migration practice.",
      priceId: process.env.STRIPE_PRICE_ID_STARTER || "",
      workspaceSummary: "Single workspace, core operations, review-required workflows."
    },
    {
      plan: BillingPlan.PRO,
      label: "Pro",
      description: "Growing migration team with higher throughput.",
      priceId: process.env.STRIPE_PRICE_ID_PRO || "",
      workspaceSummary: "Expanded team usage, operational controls, and billing workflow."
    },
    {
      plan: BillingPlan.TEAM,
      label: "Team",
      description: "Multi-user firm rollout with stronger operational coverage.",
      priceId: process.env.STRIPE_PRICE_ID_TEAM || "",
      workspaceSummary: "Firm-wide rollout with subscription oversight and optional invoice payments."
    }
  ] as const;
}

export function buildStripeSuccessUrl() {
  return process.env.STRIPE_SUCCESS_URL || "";
}

export function buildStripeCancelUrl() {
  return process.env.STRIPE_CANCEL_URL || "";
}

export function buildWorkspaceCheckoutPayload(input: {
  workspaceId: string;
  billingEmail?: string | null;
  plan: BillingPlan;
}) {
  return {
    mode: "subscription" as const,
    customer_email: input.billingEmail || undefined,
    success_url: buildStripeSuccessUrl(),
    cancel_url: buildStripeCancelUrl(),
    line_items: [{ price: input.plan === BillingPlan.STARTER ? process.env.STRIPE_PRICE_ID_STARTER || "" : input.plan === BillingPlan.PRO ? process.env.STRIPE_PRICE_ID_PRO || "" : process.env.STRIPE_PRICE_ID_TEAM || "", quantity: 1 }],
    metadata: buildWorkspaceCheckoutMetadata({
      workspaceId: input.workspaceId,
      plan: input.plan
    })
  };
}

export function buildInvoicePaymentPayload(input: {
  workspaceId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerEmail?: string | null;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return {
    mode: "payment" as const,
    customer_email: input.customerEmail || undefined,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    invoice_number: input.invoiceNumber,
    amount_cents: input.amountCents,
    currency: input.currency,
    metadata: buildInvoicePaymentMetadata({
      workspaceId: input.workspaceId,
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber
    })
  };
}
