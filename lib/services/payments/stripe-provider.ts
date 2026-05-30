import { serverLog } from "@/lib/services/runtime-config";
import { getPaymentProviderEnv } from "@/lib/providers/payment-provider";
import { redactBillingError } from "@/lib/services/payments/billing-redaction";

type StripeResponse<T> = T & { id: string };

export type StripeCheckoutSessionInput = {
  customerId?: string | null;
  customerEmail?: string | null;
  priceId?: string | null;
  successUrl: string;
  cancelUrl: string;
  mode: "subscription" | "payment";
  metadata: Record<string, string>;
  lineItems?: Array<{ priceId?: string | null; quantity?: number; priceData?: Record<string, unknown> }>;
};

export type StripePortalSessionInput = {
  customerId: string;
  returnUrl: string;
};

export type StripeInvoicePaymentInput = {
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  amountCents: number;
  currency: string;
  invoiceNumber: string;
  metadata: Record<string, string>;
};

type StripeApiError = { error?: { message?: string } };

function requireStripeConfig() {
  const env = getPaymentProviderEnv();
  if (!env.configured || env.provider !== "stripe") {
    throw new Error("Stripe provider is not configured.");
  }
  return env;
}

function flattenForm(prefix: string, value: unknown, target: URLSearchParams) {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenForm(`${prefix}[${index}]`, item, target));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => flattenForm(`${prefix}[${key}]`, nested, target));
    return;
  }
  target.append(prefix, String(value));
}

async function stripeFormPost<T>(path: string, body: Record<string, unknown>) {
  requireStripeConfig();
  const params = new URLSearchParams();
  Object.entries(body).forEach(([key, value]) => flattenForm(key, value, params));

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString(),
    cache: "no-store"
  });

  const json = await response.json().catch(() => ({} as StripeApiError));
  if (!response.ok) {
    const reason = (json as StripeApiError)?.error?.message || `Stripe API request failed (${response.status}).`;
    throw new Error(reason);
  }
  return json as StripeResponse<T>;
}

async function stripeGet<T>(path: string) {
  requireStripeConfig();
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    cache: "no-store"
  });
  const json = await response.json().catch(() => ({} as StripeApiError));
  if (!response.ok) {
    const reason = (json as StripeApiError)?.error?.message || `Stripe API request failed (${response.status}).`;
    throw new Error(reason);
  }
  return json as StripeResponse<T>;
}

export async function createStripeCheckoutSession(input: StripeCheckoutSessionInput) {
  try {
    const lineItems = input.lineItems?.length
      ? input.lineItems.map((item) =>
          item.priceData
            ? { price_data: item.priceData, quantity: item.quantity ?? 1 }
            : { price: item.priceId, quantity: item.quantity ?? 1 }
        )
      : input.priceId
        ? [{ price: input.priceId, quantity: 1 }]
        : [];

    return await stripeFormPost<{ url?: string; customer?: string | null; subscription?: string | null }>("checkout/sessions", {
      mode: input.mode,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer: input.customerId || undefined,
      customer_email: input.customerEmail || undefined,
      line_items: lineItems,
      metadata: input.metadata,
      allow_promotion_codes: true
    });
  } catch (error) {
    serverLog("stripe.checkout_error", { reason: redactBillingError(error) });
    throw error;
  }
}

export async function createStripeCustomerPortalSession(input: StripePortalSessionInput) {
  try {
    return await stripeFormPost<{ url?: string }>("billing_portal/sessions", {
      customer: input.customerId,
      return_url: input.returnUrl
    });
  } catch (error) {
    serverLog("stripe.portal_error", { reason: redactBillingError(error) });
    throw error;
  }
}

export async function fetchStripeSubscription(subscriptionId: string) {
  try {
    return await stripeGet<{
      status?: string;
      customer?: string;
      current_period_end?: number;
      trial_end?: number | null;
      cancel_at_period_end?: boolean;
      items?: { data?: Array<{ price?: { id?: string; nickname?: string | null } }> };
    }>(`subscriptions/${subscriptionId}`);
  } catch (error) {
    serverLog("stripe.subscription_fetch_error", { reason: redactBillingError(error), subscriptionId });
    throw error;
  }
}

export async function cancelStripeSubscription(subscriptionId: string) {
  try {
    return await stripeFormPost<{ status?: string }>(`subscriptions/${subscriptionId}`, {
      cancel_at_period_end: true
    });
  } catch (error) {
    serverLog("stripe.subscription_cancel_error", { reason: redactBillingError(error), subscriptionId });
    throw error;
  }
}

export async function createStripeInvoicePaymentSession(input: StripeInvoicePaymentInput) {
  try {
    return await stripeFormPost<{ url?: string; payment_intent?: string | null }>("checkout/sessions", {
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail || undefined,
      metadata: input.metadata,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountCents,
            product_data: {
              name: `Invoice ${input.invoiceNumber}`,
              description: "Operational invoice payment"
            }
          }
        }
      ]
    });
  } catch (error) {
    serverLog("stripe.invoice_payment_error", { reason: redactBillingError(error), invoiceNumber: input.invoiceNumber });
    throw error;
  }
}
