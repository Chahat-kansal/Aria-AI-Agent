"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CompanyProfile = {
  name: string;
  legalName: string | null;
  businessType: string | null;
  registrationNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string;
  logoUrl: string | null;
  brandColor: string | null;
};

function field(name: keyof CompanyProfile, label: string, value: string | null, type = "text") {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input name={name} type={type} defaultValue={value ?? ""} className="mt-1 w-full rounded-lg border border-border bg-white/70 p-2 text-sm" />
    </label>
  );
}

export function CompanyProfileForm({ workspace }: { workspace: CompanyProfile }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    setIsSaving(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to save company profile.");
      return;
    }

    setMessage("Company profile saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
      {field("name", "Trading name", workspace.name)}
      {field("legalName", "Registered legal name", workspace.legalName)}
      {field("businessType", "Business type", workspace.businessType)}
      {field("registrationNumber", "ABN / registration number", workspace.registrationNumber)}
      {field("contactEmail", "Business email", workspace.contactEmail, "email")}
      {field("contactPhone", "Business phone", workspace.contactPhone)}
      {field("website", "Website", workspace.website, "url")}
      {field("timezone", "Timezone", workspace.timezone)}
      {field("addressLine1", "Address line 1", workspace.addressLine1)}
      {field("addressLine2", "Address line 2", workspace.addressLine2)}
      {field("city", "City", workspace.city)}
      {field("state", "State / region", workspace.state)}
      {field("postalCode", "Postcode", workspace.postalCode)}
      {field("country", "Country", workspace.country)}
      {field("logoUrl", "Logo URL", workspace.logoUrl, "url")}
      {field("brandColor", "Brand color", workspace.brandColor)}
      <div className="md:col-span-2 flex items-center gap-3">
        <button disabled={isSaving} className="rounded-lg bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? "Saving..." : "Save company profile"}
        </button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </div>
    </form>
  );
}
