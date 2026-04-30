import Image from "next/image";
import { formatCurrency } from "@/lib/invoice-calculations";

type BrandingPreview = {
  businessName: string;
  legalName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  website?: string | null;
  abnAcn?: string | null;
  paymentInstructions?: string | null;
  bankDetails?: string | null;
  logoAssetId?: string | null;
  signatureAssetId?: string | null;
};

type PreviewLineItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  gstRateBps: number;
  isTaxInclusive?: boolean;
};

export function InvoicePreview({
  branding,
  clientName,
  clientEmail,
  clientAddress,
  invoiceNumber,
  issueDate,
  dueDate,
  currency,
  lineItems,
  subtotalCents,
  gstCents,
  discountCents,
  totalCents,
  notes,
  paymentInstructions
}: {
  branding: BrandingPreview | null;
  clientName: string;
  clientEmail?: string | null;
  clientAddress?: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  lineItems: PreviewLineItem[];
  subtotalCents: number;
  gstCents: number;
  discountCents: number;
  totalCents: number;
  notes?: string | null;
  paymentInstructions?: string | null;
}) {
  const addressLines = [
    branding?.addressLine1,
    branding?.addressLine2,
    [branding?.city, branding?.state, branding?.postalCode].filter(Boolean).join(", "),
    branding?.country
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-cyan-400/15 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
        Review required before issue or payment confirmation.
      </div>

      <div className="mx-auto w-full max-w-[540px] rounded-2xl bg-white p-8 text-slate-900 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:p-10 xl:max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-4">
            {branding?.logoAssetId ? (
              <Image
                src={`/api/invoice-assets/${branding.logoAssetId}`}
                alt={`${branding.businessName} logo`}
                width={180}
                height={60}
                className="h-14 w-auto object-contain"
                unoptimized
              />
            ) : null}
            <div className="space-y-1.5">
              <p className="text-xl font-semibold text-slate-950">{branding?.businessName || "Business branding required"}</p>
              {branding?.legalName ? <p className="text-sm text-slate-500">{branding.legalName}</p> : null}
            </div>
            <div className="space-y-1 text-sm leading-6 text-slate-600">
              {addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {branding?.contactEmail ? <p>{branding.contactEmail}</p> : null}
              {branding?.contactPhone ? <p>{branding.contactPhone}</p> : null}
              {branding?.website ? <p>{branding.website}</p> : null}
              {branding?.abnAcn ? <p>{branding.abnAcn}</p> : null}
            </div>
          </div>

          <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Document</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">INVOICE</h3>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-700">
                Review required
              </span>
            </div>
            <dl className="mt-5 space-y-2.5 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Invoice #</dt>
                <dd className="font-medium text-slate-950">{invoiceNumber || "Auto on save"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Issue date</dt>
                <dd>{issueDate || "-"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Due date</dt>
                <dd>{dueDate || "-"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Currency</dt>
                <dd>{currency}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Bill to</p>
            <p className="mt-3 text-base font-semibold text-slate-950">{clientName || "Client details required"}</p>
            {clientEmail ? <p className="mt-1 text-sm text-slate-600">{clientEmail}</p> : null}
            {clientAddress ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{clientAddress}</p> : null}
          </div>
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-700">Aria note</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              This invoice has been prepared inside Aria using workspace billing data. Final pricing, tax treatment, and delivery still require human review.
            </p>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">Description</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-slate-500">Qty</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-slate-500">Unit</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-slate-500">GST</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length ? (
                lineItems.map((item, index) => {
                  const amount = item.quantity * item.unitPriceCents;
                  return (
                    <tr key={item.id || index} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-slate-800">{item.description || "Line item description required"}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.unitPriceCents, currency)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{(item.gstRateBps / 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(amount, currency)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Add at least one real line item to build this invoice.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            {notes ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Notes</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{notes}</p>
              </div>
            ) : null}
            {(paymentInstructions || branding?.paymentInstructions || branding?.bankDetails) ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Payment instructions</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {paymentInstructions || branding?.paymentInstructions}
                </p>
                {branding?.bankDetails ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-500">{branding.bankDetails}</p> : null}
              </div>
            ) : null}
            {branding?.signatureAssetId ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Signature</p>
                <Image
                  src={`/api/invoice-assets/${branding.signatureAssetId}`}
                  alt="Signature"
                  width={220}
                  height={64}
                  className="mt-3 h-16 w-auto object-contain"
                  unoptimized
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-950">Totals</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 text-slate-700">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotalCents, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-slate-700">
                <span>GST</span>
                <span>{formatCurrency(gstCents, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-slate-700">
                <span>Discount</span>
                <span>-{formatCurrency(discountCents, currency)}</span>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between gap-4 text-base font-semibold text-slate-950">
                  <span>Total due</span>
                  <span>{formatCurrency(totalCents, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
