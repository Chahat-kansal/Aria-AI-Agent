"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";

type PortalLinkRecord = {
  id: string;
  label: string;
  purpose: string | null;
  createdAt: string | Date;
  expiresAt: string | Date;
  revokedAt: string | Date | null;
  lastViewedAt: string | Date | null;
  status: "active" | "expired" | "revoked";
  createdBy: { name: string | null; email: string } | null;
};

export function PortalAccessManager({
  clientId,
  matterId,
  initialLinks,
  clientEmail,
  emailConfigured
}: {
  clientId: string;
  matterId: string;
  initialLinks: PortalLinkRecord[];
  clientEmail?: string | null;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [links, setLinks] = useState(initialLinks);
  const [message, setMessage] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sorted = useMemo(() => [...links].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [links]);

  async function refreshLinks() {
    const response = await fetch(`/api/portal?matterId=${encodeURIComponent(matterId)}`);
    const payload = await response.json().catch(() => null) as { links?: PortalLinkRecord[]; error?: string } | null;
    if (response.ok && payload?.links) setLinks(payload.links);
  }

  async function generateLink() {
    setMessage(null);
    setGeneratedUrl(null);
    const response = await fetch("/api/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, matterId, label: "Client portal access" })
    });
    const payload = await response.json().catch(() => null) as { error?: string; portalUrl?: string; link?: string } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to create portal link.");
      return;
    }
    setGeneratedUrl(payload?.portalUrl ?? payload?.link ?? null);
    setMessage("Secure client portal link created. Raw link is shown only this time.");
    await refreshLinks();
    startTransition(() => router.refresh());
  }

  async function patchLink(portalId: string, action: "revoke" | "regenerate" | "email") {
    setMessage(null);
    setGeneratedUrl(null);
    const response = await fetch(`/api/portal/${portalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        recipientEmail: clientEmail ?? undefined
      })
    });
    const payload = await response.json().catch(() => null) as { error?: string; portalUrl?: string; emailDelivery?: { reason?: string } } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to update portal link.");
      return;
    }
    if (payload?.portalUrl) setGeneratedUrl(payload.portalUrl);
    setMessage(
      action === "revoke"
        ? "Portal link revoked."
        : action === "email"
          ? (payload?.emailDelivery?.reason ?? "Portal link sent.")
          : "Portal link regenerated. Raw link is shown only this time."
    );
    await refreshLinks();
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <GradientButton type="button" onClick={generateLink} disabled={isPending}>
          Generate portal link
        </GradientButton>
        <SubtleButton type="button" disabled className="cursor-not-allowed opacity-70">
          {emailConfigured ? "Send by email after generation" : "Email is not configured. Copy link instead."}
        </SubtleButton>
      </div>
      {generatedUrl ? (
        <SectionCard className="space-y-3 p-4">
          <p className="text-sm font-semibold text-white">One-time secure link</p>
          <p className="text-xs text-slate-400">This link gives access to the client portal for this matter. Share only with the client.</p>
          <p className="break-all rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-100">{generatedUrl}</p>
        </SectionCard>
      ) : null}
      {message ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">{message}</p> : null}

      <div className="space-y-3">
        {sorted.length ? sorted.map((link) => (
          <SectionCard key={link.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{link.label}</p>
                <p className="mt-1 text-xs text-slate-400">{link.purpose ?? "CLIENT_PORTAL"} · Created {new Date(link.createdAt).toLocaleString("en-AU")}</p>
                <p className="mt-1 text-xs text-slate-500">Expires {new Date(link.expiresAt).toLocaleString("en-AU")}</p>
                {link.createdBy ? <p className="mt-1 text-xs text-slate-500">Generated by {link.createdBy.name ?? link.createdBy.email}</p> : null}
              </div>
              <StatusPill tone={link.status === "active" ? "success" : link.status === "expired" ? "warning" : "danger"}>{link.status}</StatusPill>
            </div>
            <div className="flex flex-wrap gap-2">
              <SubtleButton type="button" onClick={() => patchLink(link.id, "regenerate")} disabled={isPending}>Regenerate link</SubtleButton>
              <SubtleButton type="button" onClick={() => patchLink(link.id, "revoke")} disabled={isPending || link.status === "revoked"}>Revoke link</SubtleButton>
              <SubtleButton type="button" onClick={() => patchLink(link.id, "email")} disabled={isPending || !emailConfigured}>Send by email</SubtleButton>
            </div>
            {link.lastViewedAt ? <p className="text-xs text-slate-500">Last used {new Date(link.lastViewedAt).toLocaleString("en-AU")}</p> : null}
          </SectionCard>
        )) : (
          <SectionCard className="p-4">
            <p className="text-sm text-slate-400">No client portal links have been generated for this matter yet.</p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

