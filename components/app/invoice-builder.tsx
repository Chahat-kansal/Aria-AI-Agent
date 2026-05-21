"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Printer, Trash2 } from "lucide-react";
import { calculateInvoiceTotals, formatCurrency, parseMoneyToCents, type InvoiceLineItemDraft } from "@/lib/invoice-calculations";
import { StatusPill } from "@/components/ui/status-pill";

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

function coerceLineItems(value: unknown, defaultGstRateBps: number): InvoiceLineItemDraft[] {
  if (!Array.isArray(value)) return [blankLineItem(defaultGstRateBps)];
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
  return items.length ? items : [blankLineItem(defaultGstRateBps)];
}

function blankLineItem(defaultGstRateBps: number): InvoiceLineItemDraft {
  return {
    id: crypto.randomUUID(),
    serviceId: null,
    description: "",
    quantity: 1,
    unitPriceCents: 0,
    gstRateBps: defaultGstRateBps,
    isTaxInclusive: false
  };
}

function paperInputClass(extra = "") {
  return `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 ${extra}`.trim();
}

function paperTextareaClass(extra = "") {
  return `min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 ${extra}`.trim();
}

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "PAID":
      return "success";
    case "SENT":
      return "info";
    case "CANCELLED":
      return "danger";
    default:
      return "warning";
  }
}

function addressLines(branding: BrandingOption | null) {
  return [
    branding?.addressLine1,
    branding?.addressLine2,
    [branding?.city, branding?.state, branding?.postalCode].filter(Boolean).join(" "),
    branding?.country
  ].filter(Boolean);
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  primary = false
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={primary
        ? "inline-flex h-10 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-[#fff] shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
        : "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"}
    >
      {children}
    </button>
  );
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
  const [paymentInstructions, setPaymentInstructions] = useState(invoice?.paymentInstructions || branding?.paymentInstructions || branding?.bankDetails || "");
  const [generatedContent, setGeneratedContent] = useState(invoice?.generatedContent || "");
  const [lineItems, setLineItems] = useState<InvoiceLineItemDraft[]>(coerceLineItems(invoice?.lineItemsJson, defaultGstRateBps));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const activeBranding = branding && (!brandingId || branding.id === brandingId) ? branding : null;
  const selectedMatter = matters.find((entry) => entry.id === matterId) ?? null;
  const totals = useMemo(() => calculateInvoiceTotals(lineItems, parseMoneyToCents(discountInput)), [lineItems, discountInput]);
  const hasPaymentSettings = Boolean(paymentInstructions.trim());
  const statusLabel = invoice?.status || "DRAFT";

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
    setLineItems((current) => [...current, blankLineItem(defaultGstRateBps)]);
  }

  function duplicateLineItem(index: number) {
    setLineItems((current) => {
      const source = current[index];
      if (!source) return current;
      const copy = { ...source, id: crypto.randomUUID() };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  function removeLineItem(index: number) {
    setLineItems((current) => current.length === 1 ? [blankLineItem(defaultGstRateBps)] : current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSave(status: "DRAFT" | "SENT" | "PAID" | "CANCELLED" = "DRAFT") {
    setError(null);
    setMessage(null);
    if (!clientName.trim()) {
      setError("Add a client name before saving the invoice.");
      return;
    }
    if (!lineItems.some((item) => item.description.trim() && item.quantity > 0)) {
      setError("Add at least one service line before saving the invoice.");
      return;
    }

    setIsSaving(true);
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      })
    });
    const result = await response.json().catch(() => null) as { error?: string; invoice?: { id: string } } | null;
    setIsSaving(false);

    if (!response.ok) {
      setError(result?.error ?? "Unable to save the invoice right now.");
      return;
    }

    setMessage(status === "DRAFT" ? "Invoice draft saved. Billing review required before use." : "Invoice status saved. Review required before sending externally.");
    if (result?.invoice?.id && mode === "create") {
      router.push(`/app/invoices/${result.invoice.id}` as any);
    }
    router.refresh();
  }

  async function downloadPdf() {
    if (!invoice?.id) {
      setMessage("Save the invoice draft before downloading.");
      return;
    }
    setMessage("Preparing invoice download...");
    const response = await fetch(`/api/invoices/${invoice.id}/download`, { method: "POST" });
    if (!response.ok) {
      setError("Invoice download is not available right now.");
      setMessage(null);
      return;
    }
    setMessage("Download request recorded. Use browser print if a file is not returned by this build.");
  }

  return (
    <div className="invoice-document-editor -mx-2 space-y-6 pb-12 print:mx-0 print:pb-0">
      <div className="sticky top-0 z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur print:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/app/invoices" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <StatusPill tone={statusTone(statusLabel)}>{statusLabel.replaceAll("_", " ")}</StatusPill>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Billing review required</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToolbarButton onClick={() => setShowSettings((value) => !value)}>Settings</ToolbarButton>
            <ToolbarButton onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Preview</ToolbarButton>
            <ToolbarButton onClick={downloadPdf}>Download PDF</ToolbarButton>
            <ToolbarButton onClick={() => handleSave("SENT")} disabled={isSaving}>Save as sent</ToolbarButton>
            <ToolbarButton onClick={() => handleSave("DRAFT")} disabled={isSaving} primary>{isSaving ? "Saving..." : "Save draft"}</ToolbarButton>
          </div>
        </div>
        {message ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
      </div>

      {showSettings ? (
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Template</span>
              <select className={paperInputClass()} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                <option value="">No template selected</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Branding</span>
              <input className={paperInputClass()} value={activeBranding?.businessName || "Workspace default"} readOnly />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Internal note</span>
              <input className={paperInputClass()} value={generatedContent} onChange={(event) => setGeneratedContent(event.target.value)} placeholder="Optional internal Aria note" />
            </label>
          </div>
        </aside>
      ) : null}

      <article className="mx-auto max-w-[1120px] rounded-[28px] bg-white p-6 text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.16)] sm:p-8 lg:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="grid gap-8 border-b border-slate-200 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-700 text-xl font-bold text-[#fff]">
              {(activeBranding?.businessName || "Aria").slice(0, 2).toUpperCase()}
            </div>
            <input
              className="w-full bg-transparent text-3xl font-bold tracking-tight text-slate-950 outline-none focus:rounded-lg focus:bg-violet-50 focus:px-2"
              value={activeBranding?.businessName || "Workspace invoice"}
              readOnly
              aria-label="Firm name"
            />
            <div className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
              {activeBranding?.abnAcn ? <p>ABN/ACN {activeBranding.abnAcn}</p> : <p>ABN/ACN not configured</p>}
              {addressLines(activeBranding).map((line) => <p key={line}>{line}</p>)}
              {activeBranding?.contactEmail ? <p>{activeBranding.contactEmail}</p> : null}
              {activeBranding?.contactPhone ? <p>{activeBranding.contactPhone}</p> : null}
              {activeBranding?.website ? <p>{activeBranding.website}</p> : null}
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-right text-4xl font-bold uppercase tracking-[0.16em] text-violet-700">Invoice</h2>
            <div className="grid gap-3">
              <label className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">Number</span>
                <input className={paperInputClass("text-right font-semibold")} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="AUTO" />
              </label>
              <label className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">Issue date</span>
                <input className={paperInputClass("text-right")} type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
              </label>
              <label className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">Due date</span>
                <input className={paperInputClass("text-right")} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
              <label className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">Currency</span>
                <input className={paperInputClass("text-right uppercase")} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="AUD" />
              </label>
            </div>
          </div>
        </header>

        <section className="grid gap-8 border-b border-slate-200 py-8 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Bill to</p>
            <label className="block">
              <span className="sr-only">Client</span>
              <select className={paperInputClass()} value={clientId} onChange={(event) => syncClient(event.target.value)}>
                <option value="">Select or enter client details</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>
                ))}
              </select>
            </label>
            <input className={paperInputClass("text-lg font-semibold")} value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Select or enter client details" />
            <input className={paperInputClass()} type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="client@example.com" />
            <textarea className={paperTextareaClass()} value={clientAddress} onChange={(event) => setClientAddress(event.target.value)} placeholder="Client postal address" />
          </div>
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Matter / service</p>
            <select className={paperInputClass()} value={matterId} onChange={(event) => syncClientFromMatter(event.target.value)}>
              <option value="">No linked matter - manual invoice</option>
              {matters.map((matter) => (
                <option key={matter.id} value={matter.id}>{matter.client.firstName} {matter.client.lastName} - {matter.title}</option>
              ))}
            </select>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p><span className="font-semibold">Matter:</span> {selectedMatter?.title || "Manual billing item"}</p>
              <p><span className="font-semibold">Subclass:</span> {selectedMatter?.visaSubclass || "Not linked"}</p>
              <p><span className="font-semibold">Stream:</span> {selectedMatter?.visaStream || "Not set"}</p>
            </div>
          </div>
        </section>

        <section className="py-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Services</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">Editable line items</h3>
            </div>
            <button type="button" onClick={addLineItem} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-[#fff] shadow-sm hover:bg-violet-800">
              <Plus className="h-4 w-4" />
              Add line
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[940px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-600">
                <tr>
                  <th className="px-3 py-3">Service</th>
                  <th className="px-3 py-3">Description</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Unit price</th>
                  <th className="px-3 py-3 text-right">GST %</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => {
                  const amount = item.quantity * item.unitPriceCents;
                  return (
                    <tr key={item.id || index} className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <select
                          className={paperInputClass()}
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
                          {services.map((service) => <option key={service.id} value={service.id}>{service.serviceName}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <textarea className={paperTextareaClass("min-h-16")} value={item.description} onChange={(event) => updateLineItem(index, { description: event.target.value })} placeholder="Add your first service line" />
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                          <input type="checkbox" checked={Boolean(item.isTaxInclusive)} onChange={(event) => updateLineItem(index, { isTaxInclusive: event.target.checked })} />
                          GST included in unit price
                        </label>
                      </td>
                      <td className="px-3 py-3">
                        <input className={paperInputClass("text-right")} type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateLineItem(index, { quantity: Number(event.target.value) })} />
                      </td>
                      <td className="px-3 py-3">
                        <input className={paperInputClass("text-right")} value={(item.unitPriceCents / 100).toFixed(2)} onChange={(event) => updateLineItem(index, { unitPriceCents: parseMoneyToCents(event.target.value) })} />
                      </td>
                      <td className="px-3 py-3">
                        <input className={paperInputClass("text-right")} value={(item.gstRateBps / 100).toFixed(1)} onChange={(event) => updateLineItem(index, { gstRateBps: Math.round(Number(event.target.value || 0) * 100) })} />
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-950">{formatCurrency(amount, currency)}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => duplicateLineItem(index)} className="rounded-lg px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50">Copy</button>
                          <button type="button" onClick={() => removeLineItem(index)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-700 hover:bg-rose-50" aria-label="Remove line item">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-8 border-t border-slate-200 pt-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Notes</span>
              <textarea className={paperTextareaClass()} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for the client" />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Payment instructions</span>
              <textarea className={paperTextareaClass()} value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} placeholder="Add payment instructions before sending." />
            </label>
            {!hasPaymentSettings ? (
              <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Payment settings are missing. Add payment instructions and review billing/trust obligations before sharing this invoice.
              </p>
            ) : null}
          </div>
          <div className="space-y-3 rounded-2xl bg-slate-50 p-5">
            <div className="flex justify-between text-sm text-slate-700"><span>Subtotal</span><span>{formatCurrency(totals.subtotalCents, currency)}</span></div>
            <div className="flex justify-between text-sm text-slate-700"><span>GST</span><span>{formatCurrency(totals.gstCents, currency)}</span></div>
            <label className="grid grid-cols-[1fr_150px] items-center gap-3 text-sm text-slate-700">
              <span>Discount</span>
              <input className={paperInputClass("text-right")} value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} placeholder="0.00" />
            </label>
            <div className="border-t border-slate-200 pt-4">
              <div className="flex justify-between text-xl font-bold text-slate-950"><span>Total due</span><span>{formatCurrency(totals.totalCents, currency)}</span></div>
              <div className="mt-2 flex justify-between text-sm text-slate-600"><span>Paid</span><span>{formatCurrency(0, currency)}</span></div>
              <div className="mt-1 flex justify-between text-sm font-semibold text-slate-700"><span>Balance due</span><span>{formatCurrency(totals.totalCents, currency)}</span></div>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-xs leading-6 text-slate-500">
          <p>Invoice generated by Aria for operational billing support. Review services, tax treatment, payment instructions, and any trust-accounting obligations with the appropriate professional before issuing.</p>
        </footer>
      </article>
    </div>
  );
}
