import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { getAccountingProviderStatus } from "@/lib/providers/accounting-provider";
import { buildAccountingCsvExport, buildAccountingInvoicePayload } from "@/lib/services/accounting-integration";

async function main() {
  const provider = getAccountingProviderStatus();
  const invoice = await prisma.invoice.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      invoiceNumber: true,
      clientName: true,
      clientEmail: true,
      dueDate: true,
      currency: true,
      subtotalCents: true,
      gstCents: true,
      totalCents: true,
      status: true,
      lineItemsJson: true
    }
  });

  const payload = invoice ? buildAccountingInvoicePayload(invoice) : null;
  if (payload) {
    const joined = JSON.stringify(payload).toLowerCase();
    assert(!joined.includes("passport"), "Accounting payload must not include passport data.");
    assert(!joined.includes("grant"), "Accounting payload must not include visa grant data.");
    assert(!joined.includes("snippet"), "Accounting payload must not include source snippets.");
    assert(!joined.includes("reasoning"), "Accounting payload must not include AI reasoning.");
  }

  const csv = payload ? buildAccountingCsvExport([payload]) : "";

  console.log(JSON.stringify({
    pass: true,
    provider,
    hasInvoicePayloadSample: Boolean(payload),
    payloadKeys: payload ? Object.keys(payload) : [],
    csvPreview: csv.split("\n").slice(0, 2),
    notes: [
      "Dry-run export validates billing-safe field selection only.",
      "Live accounting sync must not be claimed until OAuth connection and provider-specific exchange are configured."
    ]
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
