"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatCurrency, parseMoneyToCents } from "@/lib/invoice-calculations";
import { PrimaryButton } from "@/components/ui/primary-button";
import { EmptyState } from "@/components/ui/empty-state";

type BrandingRecord = {
  id: string;
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
  defaultCurrency: string;
  defaultGstRateBps: number;
  defaultDueDays: number;
  logoAssetId?: string | null;
  signatureAssetId?: string | null;
  logoAsset?: { id: string; fileName: string } | null;
  signatureAsset?: { id: string; fileName: string } | null;
};

type ServiceRecord = {
  id: string;
  serviceName: string;
  description?: string | null;
  defaultPriceCents: number;
  currency: string;
  gstRateBps: number;
  isTaxInclusive: boolean;
  active: boolean;
};

type TemplateRecord = {
  id: string;
  name: string;
  notes?: string | null;
  extractedText?: string | null;
  detectedFieldsJson?: unknown;
  extractionWarnings?: unknown;
  asset?: { id: string; fileName: string; mimeType: string } | null;
};

function extractStringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "object" && value && "warnings" in value && Array.isArray((value as { warnings?: unknown[] }).warnings)) {
    return ((value as { warnings?: unknown[] }).warnings || []).map((item) => String(item));
  }
  return [];
}

export function InvoiceSetupWorkspace({
  branding,
  services,
  templates,
  workspaceName
}: {
  branding: BrandingRecord | null;
  services: ServiceRecord[];
  templates: TemplateRecord[];
  workspaceName: string;
}) {
  const router = useRouter();
  const [brandingState, setBrandingState] = useState<BrandingRecord | null>(branding);
  const [serviceRows, setServiceRows] = useState<ServiceRecord[]>(services);
  const [templateRows, setTemplateRows] = useState<TemplateRecord[]>(templates);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isSavingService, setIsSavingService] = useState(false);
  const [serviceDraft, setServiceDraft] = useState({
    id: "",
    serviceName: "",
    description: "",
    defaultPrice: "",
    currency: branding?.defaultCurrency || "AUD",
    gstPercent: ((branding?.defaultGstRateBps ?? 1000) / 100).toFixed(1),
    isTaxInclusive: false,
    active: true
  });

  const templateSummary = useMemo(
    () => templateRows.map((template) => ({
      ...template,
      detectedFields: extractStringList(
        typeof template.detectedFieldsJson === "object" && template.detectedFieldsJson && "detectedFields" in template.detectedFieldsJson
          ? (template.detectedFieldsJson as { detectedFields?: unknown[] }).detectedFields
          : template.detectedFieldsJson
      ),
      warnings: extractStringList(template.extractionWarnings)
    })),
    [templateRows]
  );

  async function saveBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSavingBranding(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/invoice-branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as { error?: string; branding?: BrandingRecord } | null;
    setIsSavingBranding(false);
    if (!response.ok) {
      setError(result?.error ?? "Unable to save invoice branding.");
      return;
    }
    setBrandingState(result?.branding ?? null);
    setMessage("Invoice branding updated.");
    router.refresh();
  }

  async function uploadAsset(kind: "logo" | "signature", file: File | null) {
    if (!file) return;
    setError(null);
    setMessage(null);
    setIsUploading(kind);
    const form = new FormData();
    form.append("usage", kind);
    form.append("file", file);
    const response = await fetch("/api/invoice-assets", { method: "POST", body: form });
    const result = await response.json().catch(() => null) as { error?: string; branding?: BrandingRecord } | null;
    setIsUploading(null);
    if (!response.ok) {
      setError(result?.error ?? `Unable to upload ${kind}.`);
      return;
    }
    setBrandingState(result?.branding ?? null);
    setMessage(`${kind === "logo" ? "Logo" : "Signature"} uploaded securely.`);
    router.refresh();
  }

  async function uploadTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsUploading("template");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/invoice-templates", { method: "POST", body: form });
    const result = await response.json().catch(() => null) as { error?: string; template?: TemplateRecord } | null;
    setIsUploading(null);
    if (!response.ok) {
      setError(result?.error ?? "Unable to upload invoice template.");
      return;
    }
    if (result?.template) setTemplateRows((current) => [result.template!, ...current]);
    setMessage("Invoice template uploaded. Review detected fields before relying on it.");
    (event.currentTarget as HTMLFormElement).reset();
    router.refresh();
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSavingService(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      id: serviceDraft.id || undefined,
      serviceName: serviceDraft.serviceName,
      description: serviceDraft.description,
      defaultPriceCents: parseMoneyToCents(serviceDraft.defaultPrice || "0"),
      currency: serviceDraft.currency,
      gstRateBps: Math.round(Number(serviceDraft.gstPercent || 0) * 100),
      isTaxInclusive: serviceDraft.isTaxInclusive,
      active: serviceDraft.active
    };
    const response = await fetch("/api/invoice-services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as { error?: string; service?: ServiceRecord } | null;
    setIsSavingService(false);
    if (!response.ok) {
      setError(result?.error ?? "Unable to save invoice service.");
      return;
    }
    if (result?.service) {
      setServiceRows((current) => {
        const exists = current.some((service) => service.id === result.service!.id);
        return exists
          ? current.map((service) => service.id === result.service!.id ? result.service! : service)
          : [...current, result.service!];
      });
    }
    setMessage("Invoice service pricing updated.");
    setServiceDraft({
      id: "",
      serviceName: "",
      description: "",
      defaultPrice: "",
      currency: brandingState?.defaultCurrency || "AUD",
      gstPercent: ((brandingState?.defaultGstRateBps ?? 1000) / 100).toFixed(1),
      isTaxInclusive: false,
      active: true
    });
    router.refresh();
  }

  function editService(service: ServiceRecord) {
    setServiceDraft({
      id: service.id,
      serviceName: service.serviceName,
      description: service.description || "",
      defaultPrice: (service.defaultPriceCents / 100).toFixed(2),
      currency: service.currency,
      gstPercent: (service.gstRateBps / 100).toFixed(1),
      isTaxInclusive: service.isTaxInclusive,
      active: service.active
    });
  }

  async function saveTemplateCorrection(event: FormEvent<HTMLFormElement>, templateId: string) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      id: templateId,
      name: String(form.get("name") || ""),
      notes: String(form.get("notes") || ""),
      detectedFields: String(form.get("detectedFields") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      warnings: String(form.get("warnings") || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
    };
    const response = await fetch("/api/invoice-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as { error?: string; template?: TemplateRecord } | null;
    if (!response.ok) {
      setError(result?.error ?? "Unable to update invoice template.");
      return;
    }
    if (result?.template) {
      setTemplateRows((current) => current.map((template) => template.id === result.template!.id ? result.template! : template));
    }
    setMessage("Template field mapping updated.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-slate-100">Business branding</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Store the firm details Aria can use when preparing review-required invoice drafts and client-facing previews.
          </p>
          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={saveBranding}>
            <input name="businessName" defaultValue={brandingState?.businessName || workspaceName} placeholder="Business name" required />
            <input name="legalName" defaultValue={brandingState?.legalName || ""} placeholder="Legal entity name" />
            <input name="contactEmail" type="email" defaultValue={brandingState?.contactEmail || ""} placeholder="Billing email" />
            <input name="contactPhone" defaultValue={brandingState?.contactPhone || ""} placeholder="Phone number" />
            <input name="addressLine1" defaultValue={brandingState?.addressLine1 || ""} placeholder="Address line 1" />
            <input name="addressLine2" defaultValue={brandingState?.addressLine2 || ""} placeholder="Address line 2" />
            <input name="city" defaultValue={brandingState?.city || ""} placeholder="City" />
            <input name="state" defaultValue={brandingState?.state || ""} placeholder="State" />
            <input name="postalCode" defaultValue={brandingState?.postalCode || ""} placeholder="Postcode" />
            <input name="country" defaultValue={brandingState?.country || ""} placeholder="Country" />
            <input name="website" defaultValue={brandingState?.website || ""} placeholder="Website" />
            <input name="abnAcn" defaultValue={brandingState?.abnAcn || ""} placeholder="ABN / ACN / Registration" />
            <input name="defaultCurrency" defaultValue={brandingState?.defaultCurrency || "AUD"} placeholder="AUD" />
            <input name="defaultGstRateBps" defaultValue={brandingState?.defaultGstRateBps ?? 1000} type="number" placeholder="1000" />
            <input name="defaultDueDays" defaultValue={brandingState?.defaultDueDays ?? 7} type="number" placeholder="7" />
            <div className="md:col-span-2">
              <textarea name="paymentInstructions" defaultValue={brandingState?.paymentInstructions || ""} placeholder="Default payment instructions shown on invoices" />
            </div>
            <div className="md:col-span-2">
              <textarea name="bankDetails" defaultValue={brandingState?.bankDetails || ""} placeholder="Bank account / remittance details" />
            </div>
            <div className="md:col-span-2">
              <PrimaryButton disabled={isSavingBranding}>{isSavingBranding ? "Saving..." : "Save branding"}</PrimaryButton>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-slate-100">Logo, signature, and template assets</h3>
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Logo</p>
                  <p className="mt-1 text-xs text-slate-400">{brandingState?.logoAsset?.fileName || "No logo uploaded yet"}</p>
                </div>
                {brandingState?.logoAssetId ? <Image src={`/api/invoice-assets/${brandingState.logoAssetId}`} alt="Invoice logo" width={144} height={48} className="h-12 w-auto rounded-2xl border border-white/10 bg-white/5 p-2" unoptimized /> : null}
              </div>
              <input type="file" accept="image/*" className="mt-3" onChange={(event) => uploadAsset("logo", event.target.files?.[0] || null)} />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Signature</p>
                  <p className="mt-1 text-xs text-slate-400">{brandingState?.signatureAsset?.fileName || "No signature uploaded yet"}</p>
                </div>
                {brandingState?.signatureAssetId ? <Image src={`/api/invoice-assets/${brandingState.signatureAssetId}`} alt="Invoice signature" width={144} height={48} className="h-12 w-auto rounded-2xl border border-white/10 bg-white/5 p-2" unoptimized /> : null}
              </div>
              <input type="file" accept="image/*" className="mt-3" onChange={(event) => uploadAsset("signature", event.target.files?.[0] || null)} />
            </div>
            <form className="rounded-3xl border border-white/10 bg-white/[0.04] p-4" onSubmit={uploadTemplate}>
              <p className="text-sm font-medium text-white">Template upload</p>
              <p className="mt-1 text-xs text-slate-400">Upload PDF, DOCX, or TXT templates. Aria extracts text where possible and shows honest detection gaps.</p>
              <div className="mt-3 space-y-3">
                <input name="name" placeholder="Template name" required />
                <textarea name="notes" placeholder="Internal notes about when to use this template" />
                <input name="file" type="file" required accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" />
                <PrimaryButton disabled={isUploading === "template"}>{isUploading === "template" ? "Uploading..." : "Upload template"}</PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-slate-100">Service pricing</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Store reusable migration services with real pricing so Aria can build invoices without inventing amounts.
          </p>
          <form className="mt-5 space-y-4" onSubmit={saveService}>
            <input value={serviceDraft.serviceName} onChange={(event) => setServiceDraft((current) => ({ ...current, serviceName: event.target.value }))} placeholder="Service name" required />
            <textarea value={serviceDraft.description} onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description shown on invoice line items" />
            <div className="grid gap-4 md:grid-cols-3">
              <input value={serviceDraft.defaultPrice} onChange={(event) => setServiceDraft((current) => ({ ...current, defaultPrice: event.target.value }))} placeholder="Price e.g. 450.00" required />
              <input value={serviceDraft.currency} onChange={(event) => setServiceDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="AUD" />
              <input value={serviceDraft.gstPercent} type="number" step="0.1" onChange={(event) => setServiceDraft((current) => ({ ...current, gstPercent: event.target.value }))} />
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input checked={serviceDraft.isTaxInclusive} onChange={(event) => setServiceDraft((current) => ({ ...current, isTaxInclusive: event.target.checked }))} type="checkbox" />
              Price already includes GST
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input checked={serviceDraft.active} onChange={(event) => setServiceDraft((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              Service is active and available in the invoice builder
            </label>
            <div className="flex flex-wrap gap-3">
              <PrimaryButton disabled={isSavingService}>{isSavingService ? "Saving..." : serviceDraft.id ? "Update service" : "Add service"}</PrimaryButton>
              {serviceDraft.id ? (
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 hover:bg-white/10"
                  onClick={() => setServiceDraft({
                    id: "",
                    serviceName: "",
                    description: "",
                    defaultPrice: "",
                    currency: brandingState?.defaultCurrency || "AUD",
                    gstPercent: ((brandingState?.defaultGstRateBps ?? 1000) / 100).toFixed(1),
                    isTaxInclusive: false,
                    active: true
                  })}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-slate-100">Configured services and templates</h3>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Services</p>
              {serviceRows.length ? serviceRows.map((service) => (
                <div key={service.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{service.serviceName}</p>
                    <span className="text-xs text-slate-400">{service.active ? "Active" : "Inactive"}</span>
                  </div>
                  {service.description ? <p className="mt-2 text-sm leading-6 text-slate-300">{service.description}</p> : null}
                  <p className="mt-3 text-sm text-cyan-300">{formatCurrency(service.defaultPriceCents, service.currency)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    GST {(service.gstRateBps / 100).toFixed(1)}% {service.isTaxInclusive ? "included" : "added"}
                  </p>
                  <button
                    type="button"
                    className="mt-3 inline-flex h-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-100 hover:bg-white/10"
                    onClick={() => editService(service)}
                  >
                    Edit service
                  </button>
                </div>
              )) : <EmptyState title="No services yet" description="Add at least one priced service so the manual builder and Aria generator can use real amounts." />}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Templates</p>
              {templateSummary.length ? templateSummary.map((template) => (
                <div key={template.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold text-white">{template.name}</p>
                  {template.notes ? <p className="mt-2 text-sm leading-6 text-slate-300">{template.notes}</p> : null}
                  {template.asset ? <p className="mt-2 text-xs text-slate-400">{template.asset.fileName}</p> : null}
                  {template.detectedFields.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {template.detectedFields.map((field) => (
                        <span key={field} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] uppercase tracking-wide text-cyan-300">
                          {field}
                        </span>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-xs text-slate-500">No fields were confidently detected.</p>}
                  {template.warnings.length ? (
                    <div className="mt-3 space-y-2">
                      {template.warnings.map((warning) => (
                        <p key={warning} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-300">{warning}</p>
                      ))}
                    </div>
                  ) : null}
                  <form className="mt-4 space-y-3" onSubmit={(event) => saveTemplateCorrection(event, template.id)}>
                    <input name="name" defaultValue={template.name} />
                    <textarea name="notes" defaultValue={template.notes || ""} placeholder="Internal notes" />
                    <input
                      name="detectedFields"
                      defaultValue={template.detectedFields.join(", ")}
                      placeholder="Comma-separated detected fields"
                    />
                    <textarea
                      name="warnings"
                      defaultValue={template.warnings.join("\n")}
                      placeholder="One warning per line"
                    />
                    <PrimaryButton>Save corrections</PrimaryButton>
                  </form>
                </div>
              )) : <EmptyState title="No templates uploaded" description="Upload a real template file if your firm wants Aria to align invoice wording or layout cues." />}
            </div>
          </div>
        </div>
      </section>

      {(message || error) ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm">
          {message ? <p className="text-emerald-300">{message}</p> : null}
          {error ? <p className="text-red-300">{error}</p> : null}
          {isUploading ? <p className="mt-2 text-slate-400">Processing {isUploading} upload securely...</p> : null}
        </div>
      ) : null}
    </div>
  );
}
