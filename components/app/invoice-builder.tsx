"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { calculateInvoiceTotals, formatCurrency, parseMoneyToCents, type InvoiceLineItemDraft } from "@/lib/invoice-calculations";
import { InvoicePreview } from "@/components/app/invoice-preview";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
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

function fieldClassName(extra = "") {
  return `h-10 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15 ${extra}`.trim();
}

function textareaClassName(extra = "") {
  return `min-h-28 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15 ${extra}`.trim();
}

function sectionCardClassName(extra = "") {
  return `rounded-[24px] border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl ${extra}`.trim();
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

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-200">{label}</span>
      {children}
    </label>
  );
}

function InvoiceEditorSection({
  eyebrow,
  title,
  description,
  action,
  children
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={sectionCardClassName()}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p> : null}
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description ? <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InvoiceTotalsCard({
  subtotalCents,
  gstCents,
  discountCents,
  totalCents,
  currency
}: {
  subtotalCents: number;
  gstCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
      <div className="space-y-3 text-sm">
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
  );
}

function InvoiceLineItemsEditor({
  services,
  items,
  currency,
  onAdd,
  onChange,
  onRemove
}: {
  services: ServiceOption[];
  items: InvoiceLineItemDraft[];
  currency: string;
  onAdd: () => void;
  onChange: (index: number, patch: Partial<InvoiceLineItemDraft>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <InvoiceEditorSection
      eyebrow="C"
      title="Line items"
      description="Choose real workspace services or add custom items with explicit quantities, GST treatment, and live totals."
      action={
        <SecondaryButton type="button" onClick={onAdd} className="h-9 rounded-xl gap-2 px-3">
          <Plus className="h-4 w-4" />
          Add item
        </SecondaryButton>
      }
    >
      <div className="space-y-4">
        <div className="hidden overflow-x-auto 2xl:block">
          <div className="grid min-w-[854px] grid-cols-[180px_minmax(220px,1fr)_80px_120px_90px_120px_44px] gap-2 px-1 pb-2">
            {["Service", "Description", "Qty", "Unit price", "GST %", "Amount", ""].map((label) => (
              <div key={label} className="text-xs font-medium text-slate-500">
                {label}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {items.map((item, index) => {
              const amount = item.quantity * item.unitPriceCents;
              return (
                <div key={item.id || index} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                  <div className="grid min-w-[854px] grid-cols-[180px_minmax(220px,1fr)_80px_120px_90px_120px_44px] items-center gap-2">
                    <select
                      className={fieldClassName()}
                      value={item.serviceId || ""}
                      onChange={(event) => {
                        const service = services.find((entry) => entry.id === event.target.value);
                        onChange(index, service ? {
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
                          {service.serviceName}
                        </option>
                      ))}
                    </select>
                    <input className={fieldClassName()} value={item.description} onChange={(event) => onChange(index, { description: event.target.value })} placeholder="Migration service description" />
                    <input className={fieldClassName("text-right")} type="number" min="0" step="1" value={item.quantity} onChange={(event) => onChange(index, { quantity: Number(event.target.value) })} />
                    <input className={fieldClassName("text-right")} value={(item.unitPriceCents / 100).toFixed(2)} onChange={(event) => onChange(index, { unitPriceCents: parseMoneyToCents(event.target.value) })} />
                    <input className={fieldClassName("text-right")} value={(item.gstRateBps / 100).toFixed(1)} onChange={(event) => onChange(index, { gstRateBps: Math.round(Number(event.target.value || 0) * 100) })} />
                    <div className="flex h-10 items-center justify-end rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm font-medium text-white">
                      {formatCurrency(amount, currency)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(item.isTaxInclusive)}
                        onChange={(event) => onChange(index, { isTaxInclusive: event.target.checked })}
                      />
                      GST included in unit price
                    </label>
                    <span className="text-xs text-slate-500">Review tax treatment before sending.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 2xl:hidden">
          {items.map((item, index) => {
            const amount = item.quantity * item.unitPriceCents;
            return (
              <div key={item.id || index} className="space-y-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Service">
                    <select
                      className={fieldClassName()}
                      value={item.serviceId || ""}
                      onChange={(event) => {
                        const service = services.find((entry) => entry.id === event.target.value);
                        onChange(index, service ? {
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
                          {service.serviceName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Description">
                    <input className={fieldClassName()} value={item.description} onChange={(event) => onChange(index, { description: event.target.value })} placeholder="Migration service description" />
                  </Field>
                  <Field label="Qty">
                    <input className={fieldClassName()} type="number" min="0" step="1" value={item.quantity} onChange={(event) => onChange(index, { quantity: Number(event.target.value) })} />
                  </Field>
                  <Field label="Unit price">
                    <input className={fieldClassName()} value={(item.unitPriceCents / 100).toFixed(2)} onChange={(event) => onChange(index, { unitPriceCents: parseMoneyToCents(event.target.value) })} />
                  </Field>
                  <Field label="GST %">
                    <input className={fieldClassName()} value={(item.gstRateBps / 100).toFixed(1)} onChange={(event) => onChange(index, { gstRateBps: Math.round(Number(event.target.value || 0) * 100) })} />
                  </Field>
                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-slate-200">Amount</span>
                    <div className="flex h-10 items-center justify-end rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm font-medium text-white">
                      {formatCurrency(amount, currency)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(item.isTaxInclusive)}
                      onChange={(event) => onChange(index, { isTaxInclusive: event.target.checked })}
                    />
                    GST included
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 px-3 text-sm font-medium text-red-200 hover:bg-red-500/20"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-slate-400">
          GST-inclusive pricing is managed per line item below the row, so the editor stays readable and aligned.
        </p>
      </div>
    </InvoiceEditorSection>
  );
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

  const statusLabel = invoice?.status || "DRAFT";

  return (
    <div className="space-y-6 pb-24 xl:pb-0">
      <div className={sectionCardClassName("p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={statusTone(statusLabel)}>{statusLabel}</StatusPill>
              <span className="text-sm text-slate-400">
                {mode === "edit" ? "Changes save back to this workspace invoice record." : "Create a new workspace invoice draft."}
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-300">
              Review required before sending, marking paid, or sharing this invoice externally.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SecondaryButton type="button" onClick={() => window.print()} className="h-10 rounded-xl px-4">
              Preview / Print
            </SecondaryButton>
            <SecondaryButton type="button" disabled={isSaving} onClick={() => handleSave("SENT")} className="h-10 rounded-xl px-4">
              {isSaving ? "Working..." : "Save as sent"}
            </SecondaryButton>
            <PrimaryButton type="button" disabled={isSaving} onClick={() => handleSave("DRAFT")} className="h-10 rounded-xl px-4">
              {isSaving ? "Saving..." : "Save draft"}
            </PrimaryButton>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.58fr)_minmax(360px,1.02fr)]">
        <div className="min-w-0 space-y-5">
          <InvoiceEditorSection eyebrow="A" title="Client" description="Link a matter or client record, then confirm the billing contact details that should appear on the invoice.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Matter">
                <select className={fieldClassName()} value={matterId} onChange={(event) => syncClientFromMatter(event.target.value)}>
                  <option value="">No linked matter</option>
                  {matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.client.firstName} {matter.client.lastName} - {matter.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Client">
                <select className={fieldClassName()} value={clientId} onChange={(event) => syncClient(event.target.value)}>
                  <option value="">Manual client entry</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Client name">
                <input className={fieldClassName()} value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client full name" />
              </Field>
              <Field label="Client email">
                <input className={fieldClassName()} type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="billing@client.com" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Client address">
                  <textarea className={textareaClassName("min-h-[112px]")} value={clientAddress} onChange={(event) => setClientAddress(event.target.value)} placeholder="Client postal address" />
                </Field>
              </div>
            </div>
          </InvoiceEditorSection>

          <InvoiceEditorSection eyebrow="B" title="Invoice details" description="Set the key invoice identifiers and defaults that drive issue timing, payment windows, and template selection.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
              <div className="xl:col-span-4">
                <Field label="Invoice number">
                  <input className={fieldClassName()} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="AUTO" />
                </Field>
              </div>
              <div className="xl:col-span-3">
                <Field label="Issue date">
                  <input className={fieldClassName()} type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                </Field>
              </div>
              <div className="xl:col-span-3">
                <Field label="Due date">
                  <input className={fieldClassName()} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </Field>
              </div>
              <div className="xl:col-span-2">
                <Field label="Currency">
                  <input className={fieldClassName()} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="AUD" />
                </Field>
              </div>
              <div className="xl:col-span-4">
                <Field label="Template">
                  <select className={fieldClassName()} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                    <option value="">No template selected</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="xl:col-span-4">
                <Field label="Branding source">
                  <input className={fieldClassName()} value={activeBranding?.businessName || "Workspace default"} readOnly />
                </Field>
              </div>
              <div className="xl:col-span-4">
                <Field label="Discount">
                  <input className={fieldClassName()} value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} placeholder="0.00" />
                </Field>
              </div>
            </div>
          </InvoiceEditorSection>

          <InvoiceLineItemsEditor
            services={services}
            items={lineItems}
            currency={currency}
            onAdd={addLineItem}
            onChange={updateLineItem}
            onRemove={removeLineItem}
          />

          <InvoiceEditorSection eyebrow="D" title="Notes and payment" description="Add human-reviewed notes, remittance instructions, or internal Aria draft context without changing the invoice calculations.">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Notes">
                <textarea className={textareaClassName()} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for the client" />
              </Field>
              <Field label="Payment instructions">
                <textarea className={textareaClassName()} value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} placeholder="Bank transfer, card, or trust account instructions" />
              </Field>
              <div className="lg:col-span-2">
                <Field label="Internal generation note">
                  <textarea className={textareaClassName("min-h-[96px]")} value={generatedContent} onChange={(event) => setGeneratedContent(event.target.value)} placeholder="Optional internal summary or Aria context note" />
                </Field>
              </div>
            </div>
          </InvoiceEditorSection>

          <InvoiceEditorSection eyebrow="E" title="Actions" description="Save safely as a draft, or stage the record for firm review and client sending without losing the current calculations.">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                <div className="rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                  Aria assists with wording and structure, but final invoice approval remains with your team.
                </div>
                {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
                {error ? <p className="text-sm text-red-300">{error}</p> : null}
              </div>
              <InvoiceTotalsCard
                subtotalCents={totals.subtotalCents}
                gstCents={totals.gstCents}
                discountCents={totals.discountCents}
                totalCents={totals.totalCents}
                currency={currency}
              />
            </div>
          </InvoiceEditorSection>
        </div>

        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/90 p-4 backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <SecondaryButton type="button" onClick={() => window.print()} className="h-10 rounded-xl px-4">
            Preview / Print
          </SecondaryButton>
          <SecondaryButton type="button" disabled={isSaving} onClick={() => handleSave("SENT")} className="h-10 rounded-xl px-4">
            Save as sent
          </SecondaryButton>
          <PrimaryButton type="button" disabled={isSaving} onClick={() => handleSave("DRAFT")} className="h-10 rounded-xl px-4">
            {isSaving ? "Saving..." : "Save draft"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
