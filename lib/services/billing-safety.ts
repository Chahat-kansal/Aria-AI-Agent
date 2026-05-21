import { InvoiceStatus } from "@prisma/client";

export type BillingStage = "retainer" | "preparation" | "lodgement-preparation" | "balance" | "ad-hoc";

export type BillingSafetyInvoice = {
  status: InvoiceStatus;
  totalCents: number;
  paidCents?: number | null;
  dueDate: Date;
  issueDate: Date;
};

export const billingSafetyPolicy = {
  storesCardOrBankDetails: false,
  processesPaymentsDirectly: false,
  claimsTrustAccountingCompliance: false,
  trustAccountingWarning: "Trust accounting obligations must be reviewed by an accountant or legal professional.",
  allowedData: ["invoice status", "workspace pricing", "service descriptions", "matter/client billing reference", "payment status"],
  blockedData: ["card numbers", "bank credentials", "payment secrets", "raw document contents", "passport numbers", "draft field values"]
};

export const billingStageTemplates: Array<{
  stage: BillingStage;
  label: string;
  description: string;
  reviewRequired: true;
}> = [
  { stage: "retainer", label: "Retainer invoice", description: "Initial professional fee or retainer request, subject to firm review.", reviewRequired: true },
  { stage: "preparation", label: "Preparation-stage invoice", description: "Matter preparation, document review, or draft support stage.", reviewRequired: true },
  { stage: "lodgement-preparation", label: "Pre-lodgement preparation invoice", description: "Operational stage invoice. Aria does not lodge applications.", reviewRequired: true },
  { stage: "balance", label: "Balance invoice", description: "Remaining balance request after firm review of services and payments.", reviewRequired: true },
  { stage: "ad-hoc", label: "Ad-hoc professional service invoice", description: "Manual service invoice for firm-defined migration work.", reviewRequired: true }
];

export function inferBillingStage(label: string): BillingStage {
  const lower = label.toLowerCase();
  if (lower.includes("retainer")) return "retainer";
  if (lower.includes("balance")) return "balance";
  if (lower.includes("lodgement") || lower.includes("submission")) return "lodgement-preparation";
  if (lower.includes("preparation") || lower.includes("document") || lower.includes("draft")) return "preparation";
  return "ad-hoc";
}

export function buildBillingSafetySummary(invoices: BillingSafetyInvoice[], now = new Date()) {
  const overdue = invoices.filter((invoice) => invoice.status !== InvoiceStatus.PAID && invoice.status !== InvoiceStatus.CANCELLED && invoice.dueDate.getTime() < now.getTime());
  const unpaidCents = invoices.reduce((sum, invoice) => {
    if (invoice.status === InvoiceStatus.CANCELLED || invoice.status === InvoiceStatus.PAID) return sum;
    return sum + Math.max(0, invoice.totalCents - (invoice.paidCents ?? 0));
  }, 0);

  return {
    invoiceCount: invoices.length,
    overdueCount: overdue.length,
    unpaidCents,
    directPaymentStorage: billingSafetyPolicy.storesCardOrBankDetails,
    trustAccountingClaimed: billingSafetyPolicy.claimsTrustAccountingCompliance,
    warnings: [
      billingSafetyPolicy.trustAccountingWarning,
      "Invoice records are operational billing support only and must be reviewed by the firm before sending.",
      "Do not include private document contents, passport numbers, or draft field values in invoice descriptions."
    ]
  };
}
