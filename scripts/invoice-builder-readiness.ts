import { existsSync, readFileSync } from "node:fs";
import { calculateInvoiceTotals, parseMoneyToCents } from "@/lib/invoice-calculations";

type Check = {
  name: string;
  pass: boolean;
  detail?: string;
};

function read(path: string) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

const invoiceBuilder = read("components/app/invoice-builder.tsx");
const globals = read("app/globals.css");
const newInvoicePage = read("app/app/invoices/new/page.tsx");
const editInvoicePage = read("app/app/invoices/[invoiceId]/page.tsx");

const totals = calculateInvoiceTotals([
  {
    id: "fixed-fee",
    description: "Subclass 500 preparation fee",
    quantity: 1,
    unitPriceCents: 220000,
    gstRateBps: 1000,
    isTaxInclusive: false
  },
  {
    id: "inclusive-review",
    description: "Document review package",
    quantity: 2,
    unitPriceCents: 55000,
    gstRateBps: 1000,
    isTaxInclusive: true
  }
], parseMoneyToCents("100.00"));

const checks: Check[] = [
  {
    name: "Invoice builder component exists",
    pass: invoiceBuilder.length > 0,
    detail: "components/app/invoice-builder.tsx"
  },
  {
    name: "Invoice document is the editor",
    pass: invoiceBuilder.includes("invoice-document-editor") && !invoiceBuilder.includes("InvoicePreview"),
    detail: "Main editing surface is the invoice canvas, not a side-form plus preview."
  },
  {
    name: "Inline invoice fields exist",
    pass: ["invoiceNumber", "issueDate", "dueDate", "currency", "clientName", "clientEmail", "clientAddress"].every((token) => invoiceBuilder.includes(token)),
    detail: "Header, bill-to, date, and currency fields are editable on the document."
  },
  {
    name: "Line items edit directly in the table",
    pass: invoiceBuilder.includes("Editable line items") && invoiceBuilder.includes("Add line") && invoiceBuilder.includes("duplicateLineItem") && invoiceBuilder.includes("removeLineItem"),
    detail: "Add, copy, edit, and delete controls are present inside the invoice table."
  },
  {
    name: "Totals update from shared calculation logic",
    pass: totals.subtotalCents === 320000 && totals.gstCents === 32000 && totals.discountCents === 10000 && totals.totalCents === 342000,
    detail: `subtotal=${totals.subtotalCents}; gst=${totals.gstCents}; discount=${totals.discountCents}; total=${totals.totalCents}`
  },
  {
    name: "Save draft uses existing invoice API",
    pass: invoiceBuilder.includes('fetch("/api/invoices"') && invoiceBuilder.includes("Save draft"),
    detail: "Existing invoice save route remains the persistence path."
  },
  {
    name: "Print view hides app shell around invoice",
    pass: globals.includes("@media print") && globals.includes("body:has(.invoice-document-editor)"),
    detail: "Print CSS scopes output to the invoice document."
  },
  {
    name: "Create page uses editable invoice wording",
    pass: newInvoicePage.includes("Editable invoice document"),
    detail: "New invoice route points users at the document editor."
  },
  {
    name: "Edit page uses editable invoice wording",
    pass: editInvoicePage.includes("Editable invoice document"),
    detail: "Existing invoice route points users at the document editor."
  },
  {
    name: "No external payment or trust compliance claim added",
    pass: !invoiceBuilder.toLowerCase().includes("trust compliant") && !invoiceBuilder.toLowerCase().includes("payment processed"),
    detail: "Billing copy stays operational and review-required."
  }
];

let failed = 0;
for (const check of checks) {
  if (!check.pass) failed += 1;
  console.log(`${check.pass ? "PASS" : "FAIL"} - ${check.name}${check.detail ? `: ${check.detail}` : ""}`);
}

if (failed > 0) {
  console.error(`Invoice builder readiness failed: ${failed} check(s).`);
  process.exit(1);
}

console.log("Invoice builder readiness checks passed.");
