-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('STARTER', 'PRO', 'TEAM');

-- CreateEnum
CREATE TYPE "WorkspaceSubscriptionStatus" AS ENUM (
  'NOT_CONFIGURED',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'UNPAID',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED'
);

-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM (
  'NOT_CONFIGURED',
  'DISABLED',
  'DRAFT',
  'OPEN',
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED'
);

-- AlterTable
ALTER TABLE "Workspace"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "billingPlan" "BillingPlan",
  ADD COLUMN "subscriptionStatus" "WorkspaceSubscriptionStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "billingProvider" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceSubscription" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "plan" "BillingPlan" NOT NULL,
  "status" "WorkspaceSubscriptionStatus" NOT NULL,
  "billingEmail" TEXT,
  "trialEndsAt" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "providerMetadataJson" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "invoiceId" TEXT,
  "provider" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerEventId" TEXT,
  "status" TEXT NOT NULL,
  "summary" TEXT,
  "payloadPreviewJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePaymentLink" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "stripePaymentLinkId" TEXT,
  "checkoutSessionId" TEXT,
  "paymentIntentId" TEXT,
  "paymentStatus" "InvoicePaymentStatus" NOT NULL DEFAULT 'DRAFT',
  "paymentUrl" TEXT,
  "amountCents" INTEGER,
  "amountPaidCents" INTEGER,
  "currency" TEXT,
  "providerMetadataJson" JSONB,
  "paidAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvoicePaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_stripeCustomerId_key" ON "Workspace"("stripeCustomerId");
CREATE UNIQUE INDEX "Workspace_stripeSubscriptionId_key" ON "Workspace"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSubscription_providerSubscriptionId_key" ON "WorkspaceSubscription"("providerSubscriptionId");
CREATE INDEX "WorkspaceSubscription_workspaceId_status_idx" ON "WorkspaceSubscription"("workspaceId", "status");
CREATE INDEX "WorkspaceSubscription_provider_lastSyncedAt_idx" ON "WorkspaceSubscription"("provider", "lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_providerEventId_key" ON "BillingEvent"("providerEventId");
CREATE INDEX "BillingEvent_workspaceId_createdAt_idx" ON "BillingEvent"("workspaceId", "createdAt");
CREATE INDEX "BillingEvent_provider_eventType_createdAt_idx" ON "BillingEvent"("provider", "eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePaymentLink_stripePaymentLinkId_key" ON "InvoicePaymentLink"("stripePaymentLinkId");
CREATE UNIQUE INDEX "InvoicePaymentLink_checkoutSessionId_key" ON "InvoicePaymentLink"("checkoutSessionId");
CREATE UNIQUE INDEX "InvoicePaymentLink_paymentIntentId_key" ON "InvoicePaymentLink"("paymentIntentId");
CREATE INDEX "InvoicePaymentLink_workspaceId_paymentStatus_createdAt_idx" ON "InvoicePaymentLink"("workspaceId", "paymentStatus", "createdAt");
CREATE INDEX "InvoicePaymentLink_invoiceId_createdAt_idx" ON "InvoicePaymentLink"("invoiceId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WorkspaceSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoicePaymentLink" ADD CONSTRAINT "InvoicePaymentLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePaymentLink" ADD CONSTRAINT "InvoicePaymentLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
