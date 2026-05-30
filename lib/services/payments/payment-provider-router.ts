import { BillingPlan, type User } from "@prisma/client";
import { getPaymentProviderEnv, getPaymentProviderStatus } from "@/lib/providers/payment-provider";
import { createInvoicePaymentLink, getLatestInvoicePaymentLink, syncInvoicePaymentState } from "@/lib/services/payments/invoice-payments";
import { handleStripeWebhookEvent, hasStripeWebhookVerification } from "@/lib/services/payments/stripe-webhooks";
import {
  buildWorkspaceCheckoutDryRun,
  cancelWorkspaceSubscription,
  createWorkspaceCheckoutSession,
  createWorkspaceCustomerPortalSession,
  getWorkspaceBillingSnapshot,
  syncWorkspaceSubscription
} from "@/lib/services/payments/workspace-subscriptions";
import { buildInvoicePaymentPayload } from "@/lib/services/payments/billing-safety";
import { redactBillingPayload } from "@/lib/services/payments/billing-redaction";

type PaymentUser = Pick<User, "id" | "workspaceId" | "role" | "status" | "permissionsJson" | "visibilityScope">;

export function getPaymentProviderRouter() {
  const provider = getPaymentProviderEnv().provider;
  return provider === "stripe" ? stripePaymentRouter : disabledPaymentRouter;
}

const disabledPaymentRouter = {
  getProviderStatus: getPaymentProviderStatus,
  createCheckoutSession: async (input: { workspaceId: string; workspaceName: string; billingEmail?: string | null; plan: BillingPlan; userId: string }) => ({
    mode: "dry_run" as const,
    url: null,
    payload: buildWorkspaceCheckoutDryRun(input)
  }),
  createCustomerPortalSession: async () => ({ mode: "disabled" as const, url: null }),
  getSubscriptionStatus: async (workspaceId: string) => getWorkspaceBillingSnapshot(workspaceId),
  syncSubscription: async () => null,
  cancelSubscription: async () => ({ mode: "disabled" as const }),
  handleWebhook: handleStripeWebhookEvent,
  createInvoicePaymentLink: async (input: { workspaceId: string; invoiceId: string; user: PaymentUser }) => createInvoicePaymentLink(input),
  syncInvoicePayment: syncInvoicePaymentState,
  dryRunCheckoutPayload: buildWorkspaceCheckoutDryRun,
  dryRunInvoicePaymentPayload: (input: { workspaceId: string; invoiceId: string; invoiceNumber: string; amountCents?: number; currency?: string; customerEmail?: string | null }) =>
    redactBillingPayload(
      buildInvoicePaymentPayload({
        workspaceId: input.workspaceId,
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNumber,
        customerEmail: input.customerEmail || undefined,
        amountCents: input.amountCents ?? 0,
        currency: input.currency || "AUD",
        successUrl: process.env.STRIPE_SUCCESS_URL || "https://billing.example/success",
        cancelUrl: process.env.STRIPE_CANCEL_URL || "https://billing.example/cancel"
      })
    )
};

const stripePaymentRouter = {
  getProviderStatus: getPaymentProviderStatus,
  createCheckoutSession: createWorkspaceCheckoutSession,
  createCustomerPortalSession: createWorkspaceCustomerPortalSession,
  getSubscriptionStatus: getWorkspaceBillingSnapshot,
  syncSubscription: syncWorkspaceSubscription,
  cancelSubscription: cancelWorkspaceSubscription,
  handleWebhook: handleStripeWebhookEvent,
  createInvoicePaymentLink,
  syncInvoicePayment: syncInvoicePaymentState,
  dryRunCheckoutPayload: buildWorkspaceCheckoutDryRun,
  dryRunInvoicePaymentPayload: (input: { workspaceId: string; invoiceId: string; invoiceNumber: string; amountCents?: number; currency?: string; customerEmail?: string | null }) =>
    redactBillingPayload(
      buildInvoicePaymentPayload({
        workspaceId: input.workspaceId,
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNumber,
        customerEmail: input.customerEmail || undefined,
        amountCents: input.amountCents ?? 0,
        currency: input.currency || "AUD",
        successUrl: process.env.STRIPE_SUCCESS_URL || "https://billing.example/success",
        cancelUrl: process.env.STRIPE_CANCEL_URL || "https://billing.example/cancel"
      })
    )
};

export async function runPaymentProviderConnectionTest(workspaceId: string) {
  const snapshot = await getWorkspaceBillingSnapshot(workspaceId);
  return {
    ok: snapshot.provider.configured && hasStripeWebhookVerification(),
    providerName: snapshot.provider.providerName,
    reason: snapshot.provider.configured
      ? "Stripe environment configuration is present. Webhook signature verification is implemented."
      : "Stripe payments are not configured."
  };
}

export async function getInvoicePaymentSnapshot(invoiceId: string) {
  return getLatestInvoicePaymentLink(invoiceId);
}
