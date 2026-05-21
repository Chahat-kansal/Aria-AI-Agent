import { InvoiceStatus } from "@prisma/client";
import { billingSafetyPolicy, billingStageTemplates, buildBillingSafetySummary, inferBillingStage } from "../lib/services/billing-safety";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const now = new Date("2026-05-21T10:00:00.000Z");
const summary = buildBillingSafetySummary([
  { status: InvoiceStatus.SENT, totalCents: 220000, paidCents: 0, issueDate: new Date("2026-05-01T10:00:00.000Z"), dueDate: new Date("2026-05-15T10:00:00.000Z") },
  { status: InvoiceStatus.PAID, totalCents: 55000, paidCents: 55000, issueDate: new Date("2026-05-02T10:00:00.000Z"), dueDate: new Date("2026-05-16T10:00:00.000Z") }
], now);

assert(billingSafetyPolicy.storesCardOrBankDetails === false, "Billing must not store card or bank details.");
assert(billingSafetyPolicy.processesPaymentsDirectly === false, "Billing must not process payments directly without a secure provider.");
assert(billingSafetyPolicy.claimsTrustAccountingCompliance === false, "Aria must not claim trust-accounting compliance.");
assert(billingStageTemplates.every((stage) => stage.reviewRequired), "Every billing stage must require firm review.");
assert(summary.overdueCount === 1, "Overdue invoice summary should detect unpaid overdue invoices.");
assert(summary.unpaidCents === 220000, "Unpaid amount should exclude paid/cancelled invoices.");
assert(inferBillingStage("Retainer and onboarding") === "retainer", "Retainer stage inference failed.");
assert(!/ready to lodge|guarantee|legal advice/i.test(summary.warnings.join(" ")), "Billing warnings must avoid unsafe migration advice wording.");

console.log("Billing and trust-safe readiness passed.");
console.log(JSON.stringify({ overdueCount: summary.overdueCount, unpaidCents: summary.unpaidCents }, null, 2));
