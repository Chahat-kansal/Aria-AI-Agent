import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccountingProviderStatus } from "@/lib/providers/accounting-provider";
import { redactErrorSummary } from "@/lib/providers/shared";
import type { ProviderStatus } from "@/lib/providers/types";
import { getWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { auditIntegrationEvent } from "@/lib/services/integration-audit";
import { getInvoiceByIdForUser, scopedInvoiceWhere } from "@/lib/services/invoices";
import type { User } from "@prisma/client";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

export type InvoiceAccountingSyncState =
  | "not_configured"
  | "needs_connection"
  | "dry_run_ready"
  | "manual_csv_ready"
  | "sync_failed";

export type InvoiceAccountingSyncView = {
  state: InvoiceAccountingSyncState;
  providerName: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorSummary: string | null;
  mode: "dry_run" | "manual_csv" | "none";
};

export type AccountingInvoicePayload = {
  invoiceNumber: string;
  clientBillingName: string;
  billingEmail: string | null;
  dueDate: string;
  currency: string;
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  paymentStatus: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    gstRateBps: number;
    amountCents: number;
  }>;
};

function coerceAccountingSyncJson(value: Prisma.JsonValue | null | undefined): InvoiceAccountingSyncView {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      state: "not_configured",
      providerName: "not configured",
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastErrorSummary: null,
      mode: "none"
    };
  }

  const record = value as Record<string, unknown>;
  return {
    state: (record.state as InvoiceAccountingSyncState) || "not_configured",
    providerName: typeof record.providerName === "string" ? record.providerName : "not configured",
    lastAttemptAt: typeof record.lastAttemptAt === "string" ? record.lastAttemptAt : null,
    lastSuccessAt: typeof record.lastSuccessAt === "string" ? record.lastSuccessAt : null,
    lastErrorSummary: typeof record.lastErrorSummary === "string" ? record.lastErrorSummary : null,
    mode: record.mode === "dry_run" || record.mode === "manual_csv" ? record.mode : "none"
  };
}

export function getInvoiceAccountingSyncView(invoice: { accountingSyncJson?: Prisma.JsonValue | null }) {
  return coerceAccountingSyncJson(invoice.accountingSyncJson);
}

export function buildAccountingInvoicePayload(invoice: {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  dueDate: Date;
  currency: string;
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  status: string;
  lineItemsJson: Prisma.JsonValue;
}) {
  const lineItems = Array.isArray(invoice.lineItemsJson) ? invoice.lineItemsJson : [];
  return {
    invoiceNumber: invoice.invoiceNumber,
    clientBillingName: invoice.clientName,
    billingEmail: invoice.clientEmail ?? null,
    dueDate: invoice.dueDate.toISOString(),
    currency: invoice.currency,
    subtotalCents: invoice.subtotalCents,
    gstCents: invoice.gstCents,
    totalCents: invoice.totalCents,
    paymentStatus: invoice.status,
    lineItems: lineItems.map((item) => {
      const record = item as Record<string, unknown>;
      const quantity = Number(record.quantity || 0);
      const unitPriceCents = Number(record.unitPriceCents || 0);
      return {
        description: String(record.description || ""),
        quantity,
        unitPriceCents,
        gstRateBps: Number(record.gstRateBps || 0),
        amountCents: quantity * unitPriceCents
      };
    })
  } satisfies AccountingInvoicePayload;
}

export function buildAccountingCsvExport(invoices: AccountingInvoicePayload[]) {
  const header = [
    "invoice_number",
    "client_billing_name",
    "billing_email",
    "due_date",
    "currency",
    "subtotal_cents",
    "gst_cents",
    "total_cents",
    "payment_status",
    "line_item_count"
  ];
  const rows = invoices.map((invoice) => [
    invoice.invoiceNumber,
    invoice.clientBillingName,
    invoice.billingEmail ?? "",
    invoice.dueDate,
    invoice.currency,
    String(invoice.subtotalCents),
    String(invoice.gstCents),
    String(invoice.totalCents),
    invoice.paymentStatus,
    String(invoice.lineItems.length)
  ]);
  return [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export async function getAccountingIntegrationView(workspaceId: string) {
  const provider = getAccountingProviderStatus();
  const connection = await getWorkspaceProviderConnection(workspaceId, "accounting");
  const recentAudit = await prisma.auditEvent.findMany({
    where: {
      workspaceId,
      entityType: "IntegrationProvider",
      entityId: "accounting",
      action: { startsWith: "integration." }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  return {
    provider: {
      ...provider,
      connected: connection?.connected ?? provider.connected,
      connectionState: connection?.connectionState ?? provider.connectionState,
      connectedAccountLabel: connection?.connectedAccountLabel ?? provider.connectedAccountLabel ?? null,
      lastSyncAt: connection?.lastSyncAt ?? provider.lastSyncAt ?? null,
      lastSuccessfulActionAt: connection?.lastSuccessfulActionAt ?? provider.lastSuccessfulActionAt ?? null,
      lastErrorSummary: connection?.lastErrorSummary ?? provider.lastErrorSummary ?? null
    } satisfies ProviderStatus,
    recentAudit: recentAudit.map((event) => ({
      id: event.id,
      action: event.action,
      createdAt: event.createdAt,
      metadata: typeof event.metadataJson === "object" && event.metadataJson ? event.metadataJson : {}
    }))
  };
}

export async function listWorkspaceInvoiceAccountingStates(workspaceId: string, user: ScopedUser) {
  const invoices = await prisma.invoice.findMany({
    where: { workspaceId, ...scopedInvoiceWhere(user) },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      totalCents: true,
      currency: true,
      accountingSyncJson: true
    } as any
  });

  return invoices.map((invoice: any) => ({
    ...invoice,
    sync: getInvoiceAccountingSyncView(invoice)
  }));
}

async function updateInvoiceAccountingSync(invoiceId: string, sync: InvoiceAccountingSyncView) {
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      accountingSyncJson: sync as unknown as Prisma.InputJsonValue
    } as any
  });
}

export async function runAccountingInvoiceDryRun(input: {
  workspaceId: string;
  invoiceId: string;
  user: ScopedUser;
}) {
  const invoice = await getInvoiceByIdForUser(input.workspaceId, input.invoiceId, input.user);
  if (!invoice) {
    throw new Error("Invoice not found for this workspace scope.");
  }

  const provider = getAccountingProviderStatus();
  const connection = await getWorkspaceProviderConnection(input.workspaceId, "accounting");
  const payload = buildAccountingInvoicePayload(invoice);
  const now = new Date().toISOString();
  const nextState: InvoiceAccountingSyncView = {
    state: !provider.configured
      ? provider.state === "disabled" ? "manual_csv_ready" : "not_configured"
      : connection?.connected
        ? "dry_run_ready"
        : "needs_connection",
    providerName: provider.providerName,
    lastAttemptAt: now,
    lastSuccessAt: connection?.connected ? now : null,
    lastErrorSummary: connection?.connected ? null : redactErrorSummary("Provider configured state does not yet have an authenticated workspace connection."),
    mode: connection?.connected ? "dry_run" : "manual_csv"
  };

  await updateInvoiceAccountingSync(invoice.id, nextState);
  await auditIntegrationEvent({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    providerKey: "accounting",
    providerName: provider.providerName,
    action: "provider_tested",
    metadata: {
      mode: nextState.mode,
      invoiceId: invoice.id,
      state: nextState.state
    }
  });

  return {
    provider,
    connection,
    payload,
    csv: buildAccountingCsvExport([payload]),
    sync: nextState
  };
}
