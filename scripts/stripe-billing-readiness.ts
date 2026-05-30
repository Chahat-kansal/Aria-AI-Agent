import crypto from "crypto";
import { BillingPlan, MatterStage, MatterStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import { getPaymentProviderStatus } from "@/lib/providers/payment-provider";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import {
  canManageWorkspaceBilling,
  createWorkspaceCheckoutSession,
  createWorkspaceCustomerPortalSession,
  getWorkspaceBillingSnapshot
} from "@/lib/services/payments/workspace-subscriptions";
import { createInvoicePaymentLink } from "@/lib/services/payments/invoice-payments";
import { getPaymentProviderRouter } from "@/lib/services/payments/payment-provider-router";
import { handleStripeWebhookEvent, hasStripeWebhookVerification, verifyStripeWebhookSignature } from "@/lib/services/payments/stripe-webhooks";
import { getWorkspaceRows } from "@/lib/services/platform-admin-data";

loadScriptEnv();

type Check = { name: string; pass: boolean; detail?: string };

const WORKSPACE_SLUG = "stripe-billing-readiness";

function setEnv(overrides: Record<string, string | undefined>) {
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  });
  return () => {
    Object.entries(previous).forEach(([key, value]) => {
      if (typeof value === "undefined") delete process.env[key];
      else process.env[key] = value;
    });
  };
}

function signStripePayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function seedWorkspace() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Stripe Billing Readiness", plan: WorkspacePlan.PRO, contactEmail: "billing.owner@example.com" },
    create: {
      slug: WORKSPACE_SLUG,
      name: "Stripe Billing Readiness",
      plan: WorkspacePlan.PRO,
      contactEmail: "billing.owner@example.com"
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: "billing.owner@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER)
    },
    create: {
      workspaceId: workspace.id,
      name: "Billing Owner",
      email: "billing.owner@example.com",
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER)
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: "billing.agent@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Billing Agent",
      email: "billing.agent@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: "billing.admin@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_ADMIN)
    },
    create: {
      workspaceId: workspace.id,
      name: "Billing Admin",
      email: "billing.admin@example.com",
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_ADMIN)
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "BILLING-READINESS-CLIENT" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agent.id,
      email: "invoice.client@example.com",
      phone: "0400000222"
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "BILLING-READINESS-CLIENT",
      firstName: "Invoice",
      lastName: "Client",
      dob: new Date("1990-01-01T00:00:00.000Z"),
      nationality: "Test",
      email: "invoice.client@example.com",
      phone: "0400000222",
      assignedToUserId: agent.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "BILLING-READINESS-MATTER" },
    update: { workspaceId: workspace.id, clientId: client.id, assignedToUserId: agent.id },
    create: {
      workspaceId: workspace.id,
      matterReference: "BILLING-READINESS-MATTER",
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Billing Readiness Matter",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 50
    }
  });

  const invoice = await prisma.invoice.upsert({
    where: { workspaceId_invoiceNumber: { workspaceId: workspace.id, invoiceNumber: "INV-BILL-0001" } },
    update: {
      clientId: client.id,
      matterId: matter.id,
      createdByUserId: owner.id,
      clientName: "Invoice Client",
      clientEmail: "invoice.client@example.com",
      issueDate: new Date("2026-05-31T00:00:00.000Z"),
      dueDate: new Date("2026-06-14T00:00:00.000Z"),
      currency: "AUD",
      subtotalCents: 150000,
      gstCents: 15000,
      discountCents: 0,
      totalCents: 165000,
      lineItemsJson: [
        {
          description: "Migration services",
          quantity: 1,
          unitPriceCents: 150000,
          gstRateBps: 1000,
          isTaxInclusive: false
        }
      ],
      reviewRequired: true
    },
    create: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      createdByUserId: owner.id,
      clientName: "Invoice Client",
      clientEmail: "invoice.client@example.com",
      invoiceNumber: "INV-BILL-0001",
      issueDate: new Date("2026-05-31T00:00:00.000Z"),
      dueDate: new Date("2026-06-14T00:00:00.000Z"),
      currency: "AUD",
      subtotalCents: 150000,
      gstCents: 15000,
      discountCents: 0,
      totalCents: 165000,
      lineItemsJson: [
        {
          description: "Migration services",
          quantity: 1,
          unitPriceCents: 150000,
          gstRateBps: 1000,
          isTaxInclusive: false
        }
      ],
      reviewRequired: true
    }
  });

  await prisma.billingEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.invoicePaymentLink.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspaceSubscription.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      billingPlan: null,
      subscriptionStatus: "NOT_CONFIGURED",
      trialEndsAt: null,
      currentPeriodEnd: null,
      billingEmail: null,
      billingProvider: null
    }
  });

  return { workspace, owner, agent, admin, client, matter, invoice };
}

async function main() {
  const checks: Check[] = [];
  const seeded = await seedWorkspace();

  const restoreDisabled = setEnv({ PAYMENT_PROVIDER: "disabled" });
  const disabledStatus = getPaymentProviderStatus();
  checks.push({
    name: "Disabled provider state passes honestly",
    pass: disabledStatus.state === "disabled"
  });
  restoreDisabled();

  const restoreMissing = setEnv({
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
    STRIPE_PRICE_ID_STARTER: "",
    STRIPE_PRICE_ID_PRO: "",
    STRIPE_PRICE_ID_TEAM: "",
    STRIPE_SUCCESS_URL: "",
    STRIPE_CANCEL_URL: ""
  });
  const missingStatus = getPaymentProviderStatus();
  checks.push({
    name: "Stripe config missing state is clear",
    pass: missingStatus.state === "not_configured" && missingStatus.missingEnv.includes("STRIPE_SECRET_KEY")
  });
  checks.push({
    name: "Publishable key missing state is clear",
    pass: missingStatus.missingEnv.includes("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
  });
  checks.push({
    name: "Webhook secret missing state is clear",
    pass: missingStatus.missingEnv.includes("STRIPE_WEBHOOK_SECRET")
  });
  checks.push({
    name: "Price IDs missing state is clear",
    pass: missingStatus.missingEnv.includes("STRIPE_PRICE_ID_STARTER") && missingStatus.missingEnv.includes("STRIPE_PRICE_ID_PRO") && missingStatus.missingEnv.includes("STRIPE_PRICE_ID_TEAM")
  });

  const checkoutDryRun = await createWorkspaceCheckoutSession({
    workspaceId: seeded.workspace.id,
    workspaceName: seeded.workspace.name,
    billingEmail: seeded.owner.email,
    plan: BillingPlan.STARTER,
    userId: seeded.owner.id
  });
  const checkoutPayload = JSON.stringify(checkoutDryRun.payload).toLowerCase();
  checks.push({
    name: "Checkout dry-run contains no sensitive client matter data",
    pass: !/passport|grant|dob|document|matter|visa|client name|notes/.test(checkoutPayload)
  });

  await prisma.workspace.update({
    where: { id: seeded.workspace.id },
    data: { stripeCustomerId: "cus_dry_run_demo" }
  });
  const portalDryRun = await createWorkspaceCustomerPortalSession({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id
  });
  checks.push({
    name: "Customer portal dry-run works",
    pass: portalDryRun.mode === "dry_run" || portalDryRun.mode === "disabled"
  });

  checks.push({
    name: "Workspace owner permission required for checkout",
    pass: canManageWorkspaceBilling(seeded.owner)
  });
  checks.push({
    name: "Agent client cannot create workspace checkout",
    pass: !canManageWorkspaceBilling(seeded.agent)
  });

  checks.push({
    name: "Webhook signature verification exists",
    pass: hasStripeWebhookVerification()
  });

  const unsigned = await handleStripeWebhookEvent({
    payload: JSON.stringify({ id: "evt_unsigned", type: "customer.subscription.updated", data: { object: { metadata: { workspaceId: seeded.workspace.id } } } }),
    signatureHeader: null
  });
  checks.push({
    name: "Unsigned webhook rejected",
    pass: !unsigned.ok && unsigned.status === 400
  });

  const restoreWebhookEnv = setEnv({
    STRIPE_WEBHOOK_SECRET: "whsec_test_phase6_secret",
    STRIPE_PRICE_ID_STARTER: "price_starter_phase6",
    STRIPE_PRICE_ID_PRO: "price_pro_phase6",
    STRIPE_PRICE_ID_TEAM: "price_team_phase6"
  });

  const invalidSignature = verifyStripeWebhookSignature({
    payload: "{}",
    signatureHeader: "t=1,v1=deadbeef",
    secret: process.env.STRIPE_WEBHOOK_SECRET
  });
  checks.push({
    name: "Invalid signature webhook rejected",
    pass: !invalidSignature.ok
  });

  const validPayload = JSON.stringify({
    id: "evt_valid_subscription",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_valid_demo",
        customer: "cus_valid_demo",
        status: "active",
        current_period_end: Math.floor(new Date("2026-06-30T00:00:00.000Z").getTime() / 1000),
        trial_end: null,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { id: "price_pro_phase6" }
            }
          ]
        },
        metadata: {
          workspaceId: seeded.workspace.id,
          plan: "PRO",
          environment: "test"
        }
      }
    }
  });
  const validSignature = signStripePayload(validPayload, String(process.env.STRIPE_WEBHOOK_SECRET));
  const validWebhook = await handleStripeWebhookEvent({
    payload: validPayload,
    signatureHeader: validSignature
  });
  const billingSnapshot = await getWorkspaceBillingSnapshot(seeded.workspace.id);
  checks.push({
    name: "Valid mock webhook updates subscription state",
    pass: validWebhook.ok && billingSnapshot.workspace?.stripeSubscriptionId === "sub_valid_demo" && billingSnapshot.workspace?.billingPlan === BillingPlan.PRO
  });

  const secondPass = await handleStripeWebhookEvent({
    payload: validPayload,
    signatureHeader: validSignature
  });
  const eventCount = await prisma.billingEvent.count({
    where: { workspaceId: seeded.workspace.id, providerEventId: "evt_valid_subscription" }
  });
  checks.push({
    name: "Idempotency protection exists",
    pass: secondPass.ok && eventCount === 1
  });

  const workspaceRows = await getWorkspaceRows();
  const adminRow = workspaceRows.find((item) => item.id === seeded.workspace.id);
  checks.push({
    name: "Platform admin cannot see card payment method data",
    pass: Boolean(adminRow) && !Object.keys(adminRow as Record<string, unknown>).some((key) => /card|paymentmethod|cvc|brand/i.test(key))
  });

  const invoicePayment = await createInvoicePaymentLink({
    workspaceId: seeded.workspace.id,
    invoiceId: seeded.invoice.id,
    user: seeded.owner
  });
  const invoicePaymentPayload = JSON.stringify(invoicePayment.payload).toLowerCase();
  checks.push({
    name: "Optional invoice payment link dry-run contains no sensitive data",
    pass: !/passport|grant|dob|document|visa|notes|matter/.test(invoicePaymentPayload)
  });
  checks.push({
    name: "Invoice payment disabled state is clear when Stripe not configured",
    pass: invoicePayment.mode === "disabled" && invoicePayment.record.paymentStatus === "NOT_CONFIGURED"
  });

  const billingAudit = await prisma.auditEvent.findMany({
    where: { workspaceId: seeded.workspace.id, action: { startsWith: "billing." } },
    orderBy: { createdAt: "desc" }
  });
  checks.push({
    name: "Audit redaction works",
    pass: billingAudit.every((event) => !JSON.stringify(event.metadataJson || {}).includes("whsec_test_phase6_secret"))
  });

  restoreWebhookEnv();
  restoreMissing();

  const failed = checks.filter((check) => !check.pass);
  console.log(JSON.stringify({
    pass: failed.length === 0,
    workspace: WORKSPACE_SLUG,
    checks,
    failed
  }, null, 2));

  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
