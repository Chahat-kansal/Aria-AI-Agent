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
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-glass backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          {branding?.logoAssetId ? (
            <Image
              src={`/api/invoice-assets/${branding.logoAssetId}`}
              alt={`${branding.businessName} logo`}
              width={160}
              height={56}
              className="h-14 w-auto rounded-2xl border border-white/10 bg-white/5 p-2"
              unoptimized
            />
          ) : null}
          <div>
            <p className="text-lg font-semibold text-white">{branding?.businessName || "Workspace branding required"}</p>
            {branding?.legalName ? <p className="text-sm text-slate-400">{branding.legalName}</p> : null}
          </div>
          <div className="space-y-1 text-sm text-slate-300">
            {addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {branding?.contactEmail ? <p>{branding.contactEmail}</p> : null}
            {branding?.contactPhone ? <p>{branding.contactPhone}</p> : null}
            {branding?.website ? <p>{branding.website}</p> : null}
            {branding?.abnAcn ? <p>{branding.abnAcn}</p> : null}
          </div>
        </div>

        <div className="min-w-[240px] rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Invoice</p>
          <dl className="mt-4 space-y-2 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Number</dt>
              <dd className="font-medium text-white">{invoiceNumber || "Auto on save"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Issue date</dt>
              <dd>{issueDate || "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Due date</dt>
              <dd>{dueDate || "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Currency</dt>
              <dd>{currency}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Bill to</p>
          <p className="mt-3 text-base font-semibold text-white">{clientName || "Client details required"}</p>
          {clientEmail ? <p className="mt-1 text-sm text-slate-400">{clientEmail}</p> : null}
          {clientAddress ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{clientAddress}</p> : null}
        </div>
        <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">Review required</p>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            Aria can prepare invoice structure and wording from your workspace data, but final pricing, tax treatment, and sending still require human review.
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45 backdrop-blur-xl">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03]">
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
                  <tr key={item.id || index} className="border-t border-white/5">
                    <td className="px-4 py-3 text-slate-200">{item.description || "Line item description required"}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(item.unitPriceCents, currency)}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{(item.gstRateBps / 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-slate-200">{formatCurrency(amount, currency)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">Add at least one real line item to build this invoice.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {notes ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Notes</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{notes}</p>
            </div>
          ) : null}
          {(paymentInstructions || branding?.paymentInstructions || branding?.bankDetails) ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Payment instructions</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {paymentInstructions || branding?.paymentInstructions}
              </p>
              {branding?.bankDetails ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{branding.bankDetails}</p> : null}
            </div>
          ) : null}
          {branding?.signatureAssetId ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Signature</p>
              <Image
                src={`/api/invoice-assets/${branding.signatureAssetId}`}
                alt="Signature"
                width={220}
                height={64}
                className="mt-3 h-16 w-auto rounded-2xl border border-white/10 bg-white/5 p-2"
                unoptimized
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-slate-100">Totals</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotalCents, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span>GST</span>
              <span>{formatCurrency(gstCents, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span>Discount</span>
              <span>-{formatCurrency(discountCents, currency)}</span>
            </div>
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center justify-between gap-4 text-base font-semibold text-white">
                <span>Total due</span>
                <span>{formatCurrency(totalCents, currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
