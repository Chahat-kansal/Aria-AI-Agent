import crypto from "crypto";
import { BillingPlan, InvoicePaymentStatus, Prisma, WorkspaceSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentProviderEnv } from "@/lib/providers/payment-provider";
import { redactBillingError, redactBillingPayload } from "@/lib/services/payments/billing-redaction";
import { upsertWorkspaceSubscriptionFromBillingState } from "@/lib/services/payments/workspace-subscriptions";
import { syncInvoicePaymentState } from "@/lib/services/payments/invoice-payments";
import { auditEvent } from "@/lib/services/audit";

type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

function parseSignatureHeader(header: string) {
  const pairs = header.split(",").map((part) => part.trim()).filter(Boolean);
  const map = new Map<string, string[]>();
  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (!key || !value) continue;
    map.set(key, [...(map.get(key) || []), value]);
  }
  return map;
}

export function hasStripeWebhookVerification() {
  return true;
}

export function verifyStripeWebhookSignature(input: {
  payload: string;
  signatureHeader: string | null;
  secret?: string | null;
  toleranceSeconds?: number;
}) {
  const secret = (input.secret || process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!input.signatureHeader || !secret) {
    return { ok: false, reason: "missing_signature" as const };
  }

  const parsed = parseSignatureHeader(input.signatureHeader);
  const timestamp = parsed.get("t")?.[0];
  const v1Signatures = parsed.get("v1") || [];
  if (!timestamp || !v1Signatures.length) {
    return { ok: false, reason: "invalid_signature_header" as const };
  }

  const toleranceSeconds = input.toleranceSeconds ?? 300;
  const signedPayload = `${timestamp}.${input.payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const timestampAge = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(Number(timestamp)) || timestampAge > toleranceSeconds) {
    return { ok: false, reason: "stale_timestamp" as const };
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const valid = v1Signatures.some((candidate) => {
    try {
      const candidateBuffer = Buffer.from(candidate, "hex");
      return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
    } catch {
      return false;
    }
  });

  return valid ? { ok: true as const } : { ok: false as const, reason: "signature_mismatch" as const };
}

function toSubscriptionStatus(value?: string | null) {
  switch ((value || "").toLowerCase()) {
    case "trialing":
      return WorkspaceSubscriptionStatus.TRIALING;
    case "active":
      return WorkspaceSubscriptionStatus.ACTIVE;
    case "past_due":
      return WorkspaceSubscriptionStatus.PAST_DUE;
    case "canceled":
      return WorkspaceSubscriptionStatus.CANCELLED;
    case "unpaid":
      return WorkspaceSubscriptionStatus.UNPAID;
    case "incomplete":
      return WorkspaceSubscriptionStatus.INCOMPLETE;
    case "incomplete_expired":
      return WorkspaceSubscriptionStatus.INCOMPLETE_EXPIRED;
    default:
      return WorkspaceSubscriptionStatus.NOT_CONFIGURED;
  }
}

function mapStripePriceIdToPlan(priceId?: string | null) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_STARTER) return BillingPlan.STARTER;
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return BillingPlan.PRO;
  if (priceId === process.env.STRIPE_PRICE_ID_TEAM) return BillingPlan.TEAM;
  return null;
}

async function recordWebhookEvent(input: {
  workspaceId: string;
  providerEventId: string;
  eventType: string;
  status: string;
  summary?: string | null;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  payloadPreviewJson?: Prisma.InputJsonValue;
}) {
  return prisma.billingEvent.create({
    data: {
      workspaceId: input.workspaceId,
      provider: "stripe",
      providerEventId: input.providerEventId,
      eventType: input.eventType,
      status: input.status,
      summary: input.summary ?? null,
      subscriptionId: input.subscriptionId ?? null,
      invoiceId: input.invoiceId ?? null,
      payloadPreviewJson: input.payloadPreviewJson ?? Prisma.JsonNull
    }
  });
}

export async function handleStripeWebhookEvent(input: {
  payload: string;
  signatureHeader: string | null;
}) {
  const env = getPaymentProviderEnv();
  const signature = verifyStripeWebhookSignature({
    payload: input.payload,
    signatureHeader: input.signatureHeader,
    secret: process.env.STRIPE_WEBHOOK_SECRET
  });

  if (!signature.ok) {
    return {
      ok: false as const,
      status: 400,
      reason: signature.reason
    };
  }

  const event = JSON.parse(input.payload) as StripeWebhookEvent;
  const object = event.data?.object || {};
  const metadata = (object.metadata as Record<string, unknown> | undefined) || {};
  const workspaceId = typeof metadata.workspaceId === "string" ? metadata.workspaceId : null;

  if (!workspaceId) {
    return {
      ok: false as const,
      status: 400,
      reason: "missing_workspace_id"
    };
  }

  const existing = await prisma.billingEvent.findUnique({
    where: { providerEventId: event.id }
  });
  if (existing) {
    return {
      ok: true as const,
      status: 200,
      idempotent: true as const
    };
  }

  try {
    let summary = event.type;
    let subscriptionRecordId: string | null = null;
    let invoiceId: string | null = typeof metadata.invoiceId === "string" ? metadata.invoiceId : null;

    if (event.type.startsWith("customer.subscription.") || event.type === "checkout.session.completed") {
      const subscriptionId =
        typeof object.subscription === "string"
          ? object.subscription
          : typeof object.id === "string" && event.type.startsWith("customer.subscription.")
            ? object.id
            : null;
      const customerId = typeof object.customer === "string" ? object.customer : null;
      const plan = mapStripePriceIdToPlan(
        typeof object.plan === "object" && object.plan && typeof (object.plan as Record<string, unknown>).id === "string"
          ? String((object.plan as Record<string, unknown>).id)
          : typeof object.items === "object"
            ? String((((object.items as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined)?.[0]?.price as Record<string, unknown> | undefined)?.id || "")
            : null
      );
      const status = toSubscriptionStatus(typeof object.status === "string" ? object.status : "active");
      const subscription = await upsertWorkspaceSubscriptionFromBillingState({
        workspaceId,
        customerId,
        subscriptionId,
        plan: plan as any,
        status,
        billingEmail: typeof object.customer_email === "string" ? object.customer_email : null,
        trialEndsAt: typeof object.trial_end === "number" ? new Date(object.trial_end * 1000) : null,
        currentPeriodEnd: typeof object.current_period_end === "number" ? new Date(object.current_period_end * 1000) : null,
        cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
        providerMetadataJson: {
          priceId: plan
        }
      });
      subscriptionRecordId = subscription?.id ?? null;
      summary = `${event.type}:${status}`;

      await auditEvent({
        workspaceId,
        entityType: "Billing",
        entityId: subscriptionId ?? workspaceId,
        action: event.type === "customer.subscription.deleted" ? "billing.subscription_cancelled" : "billing.subscription_updated",
        metadata: { plan, status }
      });
    }

    if (event.type === "invoice.payment_succeeded" || event.type === "payment_intent.succeeded") {
      if (invoiceId) {
        await syncInvoicePaymentState({
          workspaceId,
          invoiceId,
          checkoutSessionId: typeof object.id === "string" && event.type !== "payment_intent.succeeded" ? object.id : null,
          paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : typeof object.id === "string" ? object.id : null,
          paymentStatus: InvoicePaymentStatus.PAID,
          amountPaidCents: typeof object.amount_received === "number" ? object.amount_received : typeof object.amount === "number" ? object.amount : null,
          paidAt: new Date()
        });
      }
      await auditEvent({
        workspaceId,
        entityType: "Billing",
        entityId: invoiceId ?? event.id,
        action: invoiceId ? "billing.invoice_payment_succeeded" : "billing.payment_succeeded",
        metadata: { invoiceId }
      });
    }

    if (event.type === "invoice.payment_failed" || event.type === "payment_intent.payment_failed") {
      if (invoiceId) {
        await syncInvoicePaymentState({
          workspaceId,
          invoiceId,
          checkoutSessionId: typeof object.id === "string" && event.type !== "payment_intent.payment_failed" ? object.id : null,
          paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : typeof object.id === "string" ? object.id : null,
          paymentStatus: InvoicePaymentStatus.FAILED
        });
      }
      await auditEvent({
        workspaceId,
        entityType: "Billing",
        entityId: invoiceId ?? event.id,
        action: invoiceId ? "billing.invoice_payment_failed" : "billing.payment_failed",
        metadata: { invoiceId }
      });
    }

    await recordWebhookEvent({
      workspaceId,
      providerEventId: event.id,
      eventType: event.type,
      status: "processed",
      summary,
      subscriptionId: subscriptionRecordId,
      invoiceId,
      payloadPreviewJson: redactBillingPayload({
        type: event.type,
        workspaceId,
        invoiceId,
        subscription: typeof object.subscription === "string" ? object.subscription : null
      })
    });

    await auditEvent({
      workspaceId,
      entityType: "Billing",
      entityId: event.id,
      action: "billing.webhook_received",
      metadata: { eventType: event.type }
    });

    return {
      ok: true as const,
      status: 200
    };
  } catch (error) {
    await auditEvent({
      workspaceId,
      entityType: "Billing",
      entityId: event.id,
      action: "billing.webhook_rejected",
      metadata: { eventType: event.type, reason: redactBillingError(error) }
    });
    return {
      ok: false as const,
      status: 500,
      reason: "processing_failed"
    };
  }
}
