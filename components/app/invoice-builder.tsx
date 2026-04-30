"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { calculateInvoiceTotals, formatCurrency, parseMoneyToCents, type InvoiceLineItemDraft } from "@/lib/invoice-calculations";
import { InvoicePreview } from "@/components/app/invoice-preview";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";

type ClientOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type MatterOption = {
  id: string;
  title: string;
  visaSubclass: string;
  visaStream: string;
  client: ClientOption;
};

type ServiceOption = {
  id: string;
  serviceName: string;
  description: string | null;
  defaultPriceCents: number;
  currency: string;
  gstRateBps: number;
  isTaxInclusive: boolean;
  active: boolean;
};

type TemplateOption = {
  id: string;
  name: string;
};

type BrandingOption = {
  id: string;
  businessName: string;
  defaultCurrency: string;
  defaultGstRateBps: number;
  defaultDueDays: number;
  paymentInstructions?: string | null;
  bankDetails?: string | null;
  logoAssetId?: string | null;
  signatureAssetId?: string | null;
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
};

type ExistingInvoice = {
  id: string;
  clientId?: string | null;
  matterId?: string | null;
  templateId?: string | null;
  brandingId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientAddress?: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  discountCents: number;
  lineItemsJson: unknown;
  notes?: string | null;
  paymentInstructions?: string | null;
  generatedContent?: string | null;
  status: string;
};

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const base = new Date(dateString);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function coerceLineItems(value: unknown, defaultGstRateBps: number) {
  if (!Array.isArray(value)) {
    return [
      {
        id: crypto.randomUUID(),
        serviceId: null,
        description: "",
        quantity: 1,
        unitPriceCents: 0,
        gstRateBps: defaultGstRateBps,
        isTaxInclusive: false
      }
    ] satisfies InvoiceLineItemDraft[];
  }

  const items = value
    .map((item) => ({
      id: typeof item === "object" && item && "id" in item ? String((item as { id?: string }).id || crypto.randomUUID()) : crypto.randomUUID(),
      serviceId: typeof item === "object" && item && "serviceId" in item ? String((item as { serviceId?: string | null }).serviceId || "") || null : null,
      description: typeof item === "object" && item && "description" in item ? String((item as { description?: string }).description || "") : "",
      quantity: typeof item === "object" && item && "quantity" in item ? Number((item as { quantity?: number }).quantity || 0) : 0,
      unitPriceCents: typeof item === "object" && item && "unitPriceCents" in item ? Number((item as { unitPriceCents?: number }).unitPriceCents || 0) : 0,
      gstRateBps: typeof item === "object" && item && "gstRateBps" in item ? Number((item as { gstRateBps?: number }).gstRateBps || defaultGstRateBps) : defaultGstRateBps,
      isTaxInclusive: typeof item === "object" && item && "isTaxInclusive" in item ? Boolean((item as { isTaxInclusive?: boolean }).isTaxInclusive) : false
    }))
    .filter((item) => item.description || item.unitPriceCents || item.quantity);

  return items.length
    ? items
    : [{
        id: crypto.randomUUID(),
        serviceId: null,
        description: "",
        quantity: 1,
        unitPriceCents: 0,
        gstRateBps: defaultGstRateBps,
        isTaxInclusive: false
      }];
}

export function InvoiceBuilder({
  mode,
  clients,
  matters,
  services,
  branding,
  templates,
  invoice
}: {
  mode: "create" | "edit";
  clients: ClientOption[];
  matters: MatterOption[];
  services: ServiceOption[];
  branding: BrandingOption | null;
  templates: TemplateOption[];
  invoice?: ExistingInvoice | null;
}) {
  const router = useRouter();
  const defaultCurrency = invoice?.currency || branding?.defaultCurrency || "AUD";
  const defaultGstRateBps = branding?.defaultGstRateBps ?? 1000;
  const baseIssueDate = invoice?.issueDate ? invoice.issueDate.slice(0, 10) : todayDateInput();
  const [clientId, setClientId] = useState(invoice?.clientId || "");
  const [matterId, setMatterId] = useState(invoice?.matterId || "");
  const [templateId, setTemplateId] = useState(invoice?.templateId || "");
  const [brandingId, setBrandingId] = useState(invoice?.brandingId || branding?.id || "");
  const [clientName, setClientName] = useState(invoice?.clientName || "");
  const [clientEmail, setClientEmail] = useState(invoice?.clientEmail || "");
  const [clientAddress, setClientAddress] = useState(invoice?.clientAddress || "");
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber || "AUTO");
  const [issueDate, setIssueDate] = useState(baseIssueDate);
  const [dueDate, setDueDate] = useState(invoice?.dueDate ? invoice.dueDate.slice(0, 10) : addDays(baseIssueDate, branding?.defaultDueDays ?? 7));
  const [currency, setCurrency] = useState(defaultCurrency);
  const [discountInput, setDiscountInput] = useState(String(((invoice?.discountCents ?? 0) / 100).toFixed(2)));
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [paymentInstructions, setPaymentInstructions] = useState(invoice?.paymentInstructions || branding?.paymentInstructions || "");
  const [generatedContent, setGeneratedContent] = useState(invoice?.generatedContent || "");
  const [lineItems, setLineItems] = useState<InvoiceLineItemDraft[]>(coerceLineItems(invoice?.lineItemsJson, defaultGstRateBps));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeBranding = branding && (!brandingId || branding.id === brandingId) ? branding : null;

  const totals = useMemo(
    () => calculateInvoiceTotals(lineItems, parseMoneyToCents(discountInput)),
    [lineItems, discountInput]
  );

  function syncClientFromMatter(nextMatterId: string) {
    setMatterId(nextMatterId);
    const matter = matters.find((entry) => entry.id === nextMatterId);
    if (!matter) return;
    setClientId(matter.client.id);
    setClientName(`${matter.client.firstName} ${matter.client.lastName}`.trim());
    setClientEmail(matter.client.email || "");
  }

  function syncClient(nextClientId: string) {
    setClientId(nextClientId);
    const client = clients.find((entry) => entry.id === nextClientId);
    if (!client) return;
    setClientName(`${client.firstName} ${client.lastName}`.trim());
    setClientEmail(client.email || "");
  }

  function updateLineItem(index: number, patch: Partial<InvoiceLineItemDraft>) {
    setLineItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addLineItem() {
    setLineItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        serviceId: null,
        description: "",
        quantity: 1,
        unitPriceCents: 0,
        gstRateBps: defaultGstRateBps,
        isTaxInclusive: false
      }
    ]);
  }

  function removeLineItem(index: number) {
    setLineItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSave(status: "DRAFT" | "SENT" | "PAID" | "CANCELLED" = "DRAFT") {
    setError(null);
    setMessage(null);
    setIsSaving(true);
    const payload = {
      invoiceId: invoice?.id,
      clientId: clientId || null,
      matterId: matterId || null,
      templateId: templateId || null,
      brandingId: brandingId || null,
      clientName,
      clientEmail,
      clientAddress,
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      discountCents: parseMoneyToCents(discountInput),
      lineItems,
      notes,
      paymentInstructions,
      generatedContent,
      reviewRequired: true,
      status
    };

    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as { error?: string; invoice?: { id: string } } | null;
    setIsSaving(false);

    if (!response.ok) {
      setError(result?.error ?? "Unable to save the invoice right now.");
      return;
    }

    setMessage(invoice ? "Invoice updated. Review required before sending." : "Invoice draft created.");
    if (result?.invoice?.id) {
      router.push(`/app/invoices/${result.invoice.id}` as any);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-100">Invoice details</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Build a review-required invoice with real client, matter, branding, and pricing data from this workspace.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Matter</label>
              <select value={matterId} onChange={(event) => syncClientFromMatter(event.target.value)}>
                <option value="">No linked matter</option>
                {matters.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.client.firstName} {matter.client.lastName} - {matter.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Client</label>
              <select value={clientId} onChange={(event) => syncClient(event.target.value)}>
                <option value="">Manual client entry</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.firstName} {client.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Client name</label>
              <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client full name" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Client email</label>
              <input type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="billing@client.com" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Client address</label>
              <textarea value={clientAddress} onChange={(event) => setClientAddress(event.target.value)} placeholder="Client postal address" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Invoice number</label>
              <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="AUTO" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Template</label>
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                <option value="">No template selected</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Issue date</label>
              <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Due date</label>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Currency</label>
              <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="AUD" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Discount</label>
              <input value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} placeholder="0.00" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Line items</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">Choose real workspace services or add custom items with explicit quantities and pricing.</p>
            </div>
            <SecondaryButton type="button" onClick={addLineItem} className="gap-2">
              <Plus className="h-4 w-4" />
              Add item
            </SecondaryButton>
          </div>

          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div key={item.id || index} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_1.3fr_0.6fr_0.8fr_0.7fr_auto]">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Service</label>
                    <select
                      value={item.serviceId || ""}
                      onChange={(event) => {
                        const service = services.find((entry) => entry.id === event.target.value);
                        updateLineItem(index, service ? {
                          serviceId: service.id,
                          description: service.description || service.serviceName,
                          quantity: item.quantity || 1,
                          unitPriceCents: service.defaultPriceCents,
                          gstRateBps: service.gstRateBps,
                          isTaxInclusive: service.isTaxInclusive
                        } : { serviceId: null });
                      }}
                    >
                      <option value="">Custom item</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.serviceName} ({formatCurrency(service.defaultPriceCents, service.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Description</label>
                    <input value={item.description} onChange={(event) => updateLineItem(index, { description: event.target.value })} placeholder="Migration service description" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Qty</label>
                    <input type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateLineItem(index, { quantity: Number(event.target.value) })} />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Unit price</label>
                    <input value={(item.unitPriceCents / 100).toFixed(2)} onChange={(event) => updateLineItem(index, { unitPriceCents: parseMoneyToCents(event.target.value) })} />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">GST %</label>
                    <input value={(item.gstRateBps / 100).toFixed(1)} onChange={(event) => updateLineItem(index, { gstRateBps: Math.round(Number(event.target.value || 0) * 100) })} />
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <label className="mt-3 flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(item.isTaxInclusive)}
                    onChange={(event) => updateLineItem(index, { isTaxInclusive: event.target.checked })}
                  />
                  Prices for this line item already include GST
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Notes</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for the client" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Payment instructions</label>
              <textarea value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} placeholder="Bank transfer, card, or trust account instructions" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Internal generation note</label>
              <textarea value={generatedContent} onChange={(event) => setGeneratedContent(event.target.value)} placeholder="Optional internal summary or draft explanation from Aria" />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton type="button" disabled={isSaving} onClick={() => handleSave("DRAFT")}>
            {isSaving ? "Saving..." : mode === "edit" ? "Save invoice" : "Save draft"}
          </PrimaryButton>
          <SecondaryButton type="button" disabled={isSaving} onClick={() => handleSave("SENT")}>
            Save as sent
          </SecondaryButton>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        </div>
      </div>

      <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <InvoicePreview
          branding={activeBranding}
          clientName={clientName}
          clientEmail={clientEmail}
          clientAddress={clientAddress}
          invoiceNumber={invoiceNumber === "AUTO" ? "Auto on save" : invoiceNumber}
          issueDate={issueDate}
          dueDate={dueDate}
          currency={currency}
          lineItems={totals.lineItems}
          subtotalCents={totals.subtotalCents}
          gstCents={totals.gstCents}
          discountCents={totals.discountCents}
          totalCents={totals.totalCents}
          notes={notes}
          paymentInstructions={paymentInstructions}
        />
      </div>
    </div>
  );
}
