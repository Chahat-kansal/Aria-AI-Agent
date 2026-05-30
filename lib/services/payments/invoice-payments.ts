import { InvoicePaymentStatus, Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentProviderEnv } from "@/lib/providers/payment-provider";
import { buildInvoicePaymentPayload } from "@/lib/services/payments/billing-safety";
import { redactBillingPayload } from "@/lib/services/payments/billing-redaction";
import { createStripeInvoicePaymentSession } from "@/lib/services/payments/stripe-provider";
import { getInvoiceByIdForUser } from "@/lib/services/invoices";
import { auditEvent } from "@/lib/services/audit";
import { getBaseUrl } from "@/lib/services/runtime-config";

type InvoicePaymentUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

export async function getLatestInvoicePaymentLink(invoiceId: string) {
  return prisma.invoicePaymentLink.findFirst({
    where: { invoiceId },
    orderBy: { createdAt: "desc" }
  });
}

export async function createInvoicePaymentLink(input: {
  workspaceId: string;
  invoiceId: string;
  user: InvoicePaymentUser;
}) {
  const invoice = await getInvoiceByIdForUser(input.workspaceId, input.invoiceId, input.user);
  if (!invoice) {
    throw new Error("Invoice not found for this workspace scope.");
  }

  const rawPayload = buildInvoicePaymentPayload({
    workspaceId: input.workspaceId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerEmail: invoice.clientEmail || undefined,
    amountCents: invoice.totalCents,
    currency: invoice.currency,
    successUrl: process.env.STRIPE_SUCCESS_URL || `${getBaseUrl()}/app/invoices/${invoice.id}?payment=success`,
    cancelUrl: process.env.STRIPE_CANCEL_URL || `${getBaseUrl()}/app/invoices/${invoice.id}?payment=cancelled`
  });
  const dryRunPayload = redactBillingPayload(rawPayload);

  const env = getPaymentProviderEnv();
  if (!env.configured) {
    const record = await prisma.invoicePaymentLink.create({
      data: {
        workspaceId: input.workspaceId,
        invoiceId: invoice.id,
        provider: "stripe",
        paymentStatus: InvoicePaymentStatus.NOT_CONFIGURED,
        amountCents: invoice.totalCents,
        currency: invoice.currency,
        providerMetadataJson: dryRunPayload as unknown as Prisma.InputJsonValue
      }
    });

    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      entityType: "InvoicePayment",
      entityId: record.id,
      action: "billing.invoice_payment_link_created",
      metadata: { invoiceId: invoice.id, mode: "disabled" }
    });

    return {
      mode: "disabled" as const,
      record,
      payload: dryRunPayload,
      url: null
    };
  }

  const session = await createStripeInvoicePaymentSession({
    customerEmail: invoice.clientEmail || null,
    successUrl: rawPayload.success_url,
    cancelUrl: rawPayload.cancel_url,
    amountCents: invoice.totalCents,
    currency: invoice.currency,
    invoiceNumber: invoice.invoiceNumber,
    metadata: rawPayload.metadata
  });

  const record = await prisma.invoicePaymentLink.create({
    data: {
      workspaceId: input.workspaceId,
      invoiceId: invoice.id,
      provider: "stripe",
      checkoutSessionId: session.id,
      paymentStatus: InvoicePaymentStatus.OPEN,
      paymentUrl: session.url ?? null,
      amountCents: invoice.totalCents,
      currency: invoice.currency,
      providerMetadataJson: {
        invoiceNumber: invoice.invoiceNumber
      }
    }
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    entityType: "InvoicePayment",
    entityId: record.id,
    action: "billing.invoice_payment_link_created",
    metadata: { invoiceId: invoice.id, mode: "live" }
  });

  return {
    mode: "live" as const,
    record,
    payload: dryRunPayload,
    url: session.url ?? null
  };
}

export async function syncInvoicePaymentState(input: {
  workspaceId: string;
  invoiceId: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  paymentStatus: InvoicePaymentStatus;
  amountPaidCents?: number | null;
  paidAt?: Date | null;
}) {
  const paymentLink = await prisma.invoicePaymentLink.findFirst({
    where: {
      workspaceId: input.workspaceId,
      invoiceId: input.invoiceId,
      OR: [
        input.checkoutSessionId ? { checkoutSessionId: input.checkoutSessionId } : undefined,
        input.paymentIntentId ? { paymentIntentId: input.paymentIntentId } : undefined
      ].filter(Boolean) as Prisma.InvoicePaymentLinkWhereInput[]
    }
  });

  if (!paymentLink) return null;

  const updated = await prisma.invoicePaymentLink.update({
    where: { id: paymentLink.id },
    data: {
      paymentStatus: input.paymentStatus,
      amountPaidCents: input.amountPaidCents ?? undefined,
      paidAt: input.paidAt ?? undefined,
      paymentIntentId: input.paymentIntentId ?? undefined
    }
  });

  if (input.paymentStatus === InvoicePaymentStatus.PAID) {
    await prisma.invoice.update({
      where: { id: input.invoiceId },
      data: { status: "PAID", paidAt: input.paidAt ?? new Date() }
    });
  }

  return updated;
}
