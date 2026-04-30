export type InvoiceLineItemDraft = {
  id?: string;
  serviceId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  gstRateBps: number;
  isTaxInclusive?: boolean;
};

export function formatCurrency(cents: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format((cents || 0) / 100);
}

export function parseMoneyToCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/[^0-9.-]/g, "");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function normalizeInvoiceLineItems(input: InvoiceLineItemDraft[]) {
  return input
    .filter((item) => item.description.trim())
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      serviceId: item.serviceId ?? null,
      description: item.description.trim(),
      quantity: Math.max(0, Number(item.quantity) || 0),
      unitPriceCents: Math.max(0, Math.round(Number(item.unitPriceCents) || 0)),
      gstRateBps: Math.max(0, Math.round(Number(item.gstRateBps) || 0)),
      isTaxInclusive: Boolean(item.isTaxInclusive)
    }));
}

export function calculateInvoiceTotals(lineItems: InvoiceLineItemDraft[], discountCents = 0) {
  const items = normalizeInvoiceLineItems(lineItems);
  let subtotalCents = 0;
  let gstCents = 0;

  for (const item of items) {
    const lineBase = item.quantity * item.unitPriceCents;
    if (item.isTaxInclusive) {
      const divisor = 1 + item.gstRateBps / 10000;
      const exGst = Math.round(lineBase / divisor);
      subtotalCents += exGst;
      gstCents += lineBase - exGst;
    } else {
      subtotalCents += lineBase;
      gstCents += Math.round(lineBase * (item.gstRateBps / 10000));
    }
  }

  const normalizedDiscount = Math.max(0, Math.round(discountCents || 0));
  const totalCents = Math.max(0, subtotalCents + gstCents - normalizedDiscount);

  return {
    lineItems: items,
    subtotalCents,
    gstCents,
    discountCents: normalizedDiscount,
    totalCents
  };
}
