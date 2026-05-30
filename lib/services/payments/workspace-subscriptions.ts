import { BillingPlan, WorkspaceSubscriptionStatus, Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentProviderEnv, getPaymentProviderStatus } from "@/lib/providers/payment-provider";
import { getBaseUrl } from "@/lib/services/runtime-config";
import { buildWorkspaceCheckoutMetadata, buildWorkspaceCheckoutPayload, getStripePlanCatalog } from "@/lib/services/payments/billing-safety";
import { createStripeCheckoutSession, createStripeCustomerPortalSession, fetchStripeSubscription, cancelStripeSubscription } from "@/lib/services/payments/stripe-provider";
import { redactBillingPayload } from "@/lib/services/payments/billing-redaction";
import { auditEvent } from "@/lib/services/audit";

type BillingUser = Pick<User, "id" | "workspaceId" | "role" | "status" | "permissionsJson">;

export function canManageWorkspaceBilling(user: BillingUser) {
  return user.role === "COMPANY_OWNER" || user.role === "COMPANY_ADMIN";
}

export function canViewWorkspaceBilling(user: BillingUser) {
  return canManageWorkspaceBilling(user);
}

export async function getWorkspaceBillingSnapshot(workspaceId: string) {
  const [workspace, latestSubscription, latestWebhook] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        billingPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        billingEmail: true,
        billingProvider: true
      }
    }),
    prisma.workspaceSubscription.findFirst({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.billingEvent.findFirst({
      where: { workspaceId, provider: "stripe" },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return {
    workspace,
    latestSubscription,
    latestWebhook,
    planCatalog: getStripePlanCatalog(),
    provider: getPaymentProviderStatus(),
    env: getPaymentProviderEnv()
  };
}

function mapStripePriceIdToPlan(priceId?: string | null) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_STARTER) return BillingPlan.STARTER;
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return BillingPlan.PRO;
  if (priceId === process.env.STRIPE_PRICE_ID_TEAM) return BillingPlan.TEAM;
  return null;
}

export function getStripePriceIdForPlan(plan: BillingPlan) {
  switch (plan) {
    case BillingPlan.STARTER:
      return process.env.STRIPE_PRICE_ID_STARTER || "";
    case BillingPlan.PRO:
      return process.env.STRIPE_PRICE_ID_PRO || "";
    case BillingPlan.TEAM:
      return process.env.STRIPE_PRICE_ID_TEAM || "";
    default:
      return "";
  }
}

export function buildWorkspaceCheckoutDryRun(input: {
  workspaceId: string;
  workspaceName: string;
  billingEmail?: string | null;
  plan: BillingPlan;
}) {
  const payload = buildWorkspaceCheckoutPayload({
    workspaceId: input.workspaceId,
    billingEmail: input.billingEmail || undefined,
    plan: input.plan
  });
  payload.success_url ||= `${getBaseUrl()}/app/settings/billing?checkout=success`;
  payload.cancel_url ||= `${getBaseUrl()}/app/settings/billing?checkout=cancelled`;
  return redactBillingPayload(payload);
}

export async function upsertWorkspaceSubscriptionFromBillingState(input: {
  workspaceId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  plan?: BillingPlan | null;
  status?: WorkspaceSubscriptionStatus | null;
  billingEmail?: string | null;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  providerMetadataJson?: Prisma.InputJsonValue;
}) {
  await prisma.workspace.update({
    where: { id: input.workspaceId },
    data: {
      stripeCustomerId: input.customerId ?? undefined,
      stripeSubscriptionId: input.subscriptionId ?? undefined,
      billingPlan: input.plan ?? undefined,
      subscriptionStatus: input.status ?? undefined,
      billingEmail: input.billingEmail ?? undefined,
      trialEndsAt: input.trialEndsAt ?? undefined,
      currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      billingProvider: "stripe"
    }
  });

  if (!input.subscriptionId || !input.plan || !input.status) return null;

  return prisma.workspaceSubscription.upsert({
    where: { providerSubscriptionId: input.subscriptionId },
    update: {
      providerCustomerId: input.customerId ?? undefined,
      plan: input.plan,
      status: input.status,
      billingEmail: input.billingEmail ?? undefined,
      trialEndsAt: input.trialEndsAt ?? undefined,
      currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      providerMetadataJson: input.providerMetadataJson ?? Prisma.JsonNull,
      lastSyncedAt: new Date()
    },
    create: {
      workspaceId: input.workspaceId,
      provider: "stripe",
      providerCustomerId: input.customerId ?? null,
      providerSubscriptionId: input.subscriptionId,
      plan: input.plan,
      status: input.status,
      billingEmail: input.billingEmail ?? null,
      trialEndsAt: input.trialEndsAt ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      providerMetadataJson: input.providerMetadataJson ?? Prisma.JsonNull,
      lastSyncedAt: new Date()
    }
  });
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

export async function syncWorkspaceSubscription(workspaceId: string, userId?: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true
    }
  });
  if (!workspace?.stripeSubscriptionId) {
    return null;
  }

  const subscription = await fetchStripeSubscription(workspace.stripeSubscriptionId);
  const plan = mapStripePriceIdToPlan(subscription.items?.data?.[0]?.price?.id);
  const synced = await upsertWorkspaceSubscriptionFromBillingState({
    workspaceId,
    customerId: typeof subscription.customer === "string" ? subscription.customer : workspace.stripeCustomerId,
    subscriptionId: workspace.stripeSubscriptionId,
    plan,
    status: toSubscriptionStatus(subscription.status),
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    providerMetadataJson: {
      priceId: subscription.items?.data?.[0]?.price?.id ?? null
    }
  });

  await auditEvent({
    workspaceId,
    userId,
    entityType: "Billing",
    entityId: workspace.stripeSubscriptionId,
    action: "billing.subscription_updated",
    metadata: {
      plan,
      status: toSubscriptionStatus(subscription.status),
      currentPeriodEnd: subscription.current_period_end ?? null
    }
  });

  return synced;
}

export async function createWorkspaceCheckoutSession(input: {
  workspaceId: string;
  workspaceName: string;
  billingEmail?: string | null;
  plan: BillingPlan;
  userId: string;
}) {
  const payload = buildWorkspaceCheckoutDryRun(input);
  const env = getPaymentProviderEnv();
  if (!env.configured) {
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "Billing",
      entityId: input.workspaceId,
      action: "billing.checkout_failed",
      metadata: { reason: "provider_not_configured", plan: input.plan }
    });
    return {
      mode: "dry_run" as const,
      url: null,
      payload
    };
  }

  const session = await createStripeCheckoutSession({
    customerId: null,
    customerEmail: input.billingEmail || null,
    priceId: getStripePriceIdForPlan(input.plan),
    successUrl: process.env.STRIPE_SUCCESS_URL || `${getBaseUrl()}/app/settings/billing?checkout=success`,
    cancelUrl: process.env.STRIPE_CANCEL_URL || `${getBaseUrl()}/app/settings/billing?checkout=cancelled`,
    mode: "subscription",
    metadata: buildWorkspaceCheckoutMetadata({ workspaceId: input.workspaceId, plan: input.plan })
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "Billing",
    entityId: session.id,
    action: "billing.checkout_created",
    metadata: { plan: input.plan, workspaceId: input.workspaceId }
  });

  return {
    mode: "live" as const,
    url: session.url ?? null,
    sessionId: session.id,
    payload
  };
}

export async function createWorkspaceCustomerPortalSession(input: {
  workspaceId: string;
  userId: string;
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { stripeCustomerId: true }
  });
  if (!workspace?.stripeCustomerId) {
    return { mode: "disabled" as const, url: null };
  }

  const env = getPaymentProviderEnv();
  if (!env.configured) {
    return { mode: "dry_run" as const, url: null };
  }

  const session = await createStripeCustomerPortalSession({
    customerId: workspace.stripeCustomerId,
    returnUrl: `${getBaseUrl()}/app/settings/billing`
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "Billing",
    entityId: workspace.stripeCustomerId,
    action: "billing.customer_portal_created",
    metadata: { workspaceId: input.workspaceId }
  });

  return {
    mode: "live" as const,
    url: session.url ?? null
  };
}

export async function cancelWorkspaceSubscription(input: {
  workspaceId: string;
  userId: string;
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { stripeSubscriptionId: true }
  });
  if (!workspace?.stripeSubscriptionId || !getPaymentProviderEnv().configured) {
    return { mode: "disabled" as const };
  }

  const response = await cancelStripeSubscription(workspace.stripeSubscriptionId);
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "Billing",
    entityId: workspace.stripeSubscriptionId,
    action: "billing.subscription_cancelled",
    metadata: { mode: "cancel_at_period_end", status: response.status ?? "unknown" }
  });
  return { mode: "live" as const, status: response.status ?? "unknown" };
}
