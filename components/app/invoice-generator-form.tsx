"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PrimaryButton } from "@/components/ui/primary-button";

type ClientOption = { id: string; firstName: string; lastName: string };
type MatterOption = { id: string; title: string; visaSubclass: string; client: ClientOption };
type ServiceOption = { id: string; serviceName: string; defaultPriceCents: number; currency: string };
type TemplateOption = { id: string; name: string };
type BrandingOption = { id: string; businessName: string; defaultCurrency: string };

export function InvoiceGeneratorForm({
  clients,
  matters,
  services,
  templates,
  branding,
  aiConfigured
}: {
  clients: ClientOption[];
  matters: MatterOption[];
  services: ServiceOption[];
  templates: TemplateOption[];
  branding: BrandingOption | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setQuestions([]);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      clientId: String(form.get("clientId") || "") || null,
      matterId: String(form.get("matterId") || "") || null,
      templateId: String(form.get("templateId") || "") || null,
      brandingId: String(form.get("brandingId") || "") || null,
      selectedServiceIds: form.getAll("serviceIds").map((value) => String(value)),
      prompt: String(form.get("prompt") || "") || null,
      issueDate: String(form.get("issueDate") || "") || undefined,
      dueDate: String(form.get("dueDate") || "") || undefined,
      currency: String(form.get("currency") || "") || null
    };
    const response = await fetch("/api/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as
      | { error?: string; status?: string; message?: string; setup?: string; missingFields?: string[]; questions?: string[]; invoice?: { id: string } }
      | null;
    setIsSubmitting(false);

    if (!response.ok && result?.status !== "not_configured") {
      setError(result?.error ?? "Unable to generate invoice with Aria right now.");
      return;
    }

    if (result?.status === "not_configured") {
      setError(result.message ?? "AI is not configured.");
      return;
    }

    if (result?.status === "needs_input") {
      setMessage("Aria needs a bit more real data before it can generate a review-required invoice.");
      setQuestions(result.questions ?? []);
      return;
    }

    if (result?.invoice?.id) {
      router.push(`/app/invoices/${result.invoice.id}` as any);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <form className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl" onSubmit={handleSubmit}>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Generate with Aria</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Aria uses only real workspace branding, selected service pricing, client and matter data, and any uploaded invoice template. Review is always required.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Client</label>
            <select name="clientId" defaultValue="">
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Matter</label>
            <select name="matterId" defaultValue="">
              <option value="">Select matter</option>
              {matters.map((matter) => (
                <option key={matter.id} value={matter.id}>{matter.client.firstName} {matter.client.lastName} - {matter.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Template</label>
            <select name="templateId" defaultValue="">
              <option value="">Latest template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Branding</label>
            <select name="brandingId" defaultValue={branding?.id || ""}>
              <option value="">Workspace default branding</option>
              {branding ? <option value={branding.id}>{branding.businessName}</option> : null}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Issue date</label>
            <input type="date" name="issueDate" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Due date</label>
            <input type="date" name="dueDate" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Currency</label>
            <input name="currency" defaultValue={branding?.defaultCurrency || "AUD"} />
          </div>
        </div>

        <fieldset className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <legend className="px-1 text-sm font-semibold text-slate-100">Services to include</legend>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {services.length ? services.map((service) => (
              <label key={service.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                <input type="checkbox" name="serviceIds" value={service.id} />
                <span>
                  <span className="block font-medium text-white">{service.serviceName}</span>
                  <span className="text-xs text-slate-400">{service.currency} {(service.defaultPriceCents / 100).toFixed(2)}</span>
                </span>
              </label>
            )) : <p className="text-sm text-slate-400">No active invoice services are configured yet.</p>}
          </div>
        </fieldset>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Aria instructions</label>
          <textarea name="prompt" placeholder="Optional guidance, such as which services to emphasize or whether to reflect a staged matter workflow." />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton disabled={isSubmitting || !aiConfigured}>
            {isSubmitting ? "Generating..." : "Generate with Aria"}
          </PrimaryButton>
          <Link href={"/app/invoices/new" as any} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10">
            Open manual builder
          </Link>
        </div>
      </form>

      <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl">
        <h3 className="text-sm font-semibold text-slate-100">Generation guardrails</h3>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <p>Aria will not invent pricing, client identity, matter context, or GST rules. If the workspace is missing any of those, it will stop and ask for the exact missing data.</p>
          <p>The generated invoice always remains a draft with <span className="font-medium text-white">review required</span> before sending or marking as paid.</p>
          <p>If AI is not configured, this page falls back honestly to the manual invoice builder instead of pretending generation succeeded.</p>
        </div>

        {!aiConfigured ? (
          <div className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-300">
            AI is not configured. Add the workspace AI provider key in environment variables, or use the manual builder for now.
          </div>
        ) : null}
        {message ? <div className="mt-5 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-200">{message}</div> : null}
        {questions.length ? (
          <div className="mt-5 space-y-2">
            {questions.map((question) => (
              <div key={question} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                {question}
              </div>
            ))}
          </div>
        ) : null}
        {error ? <div className="mt-5 rounded-3xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      </div>
    </div>
  );
}
