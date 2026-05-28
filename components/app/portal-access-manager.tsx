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

function maskPortalLink(url: string) {
  const lastSlash = url.lastIndexOf("/");
  if (lastSlash === -1) return url;
  const token = url.slice(lastSlash + 1);
  if (token.length < 10) return `${url.slice(0, lastSlash + 1)}****`;
  return `${url.slice(0, lastSlash + 1)}${token.slice(0, 6)}******${token.slice(-4)}`;
}

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
  const [copiedState, setCopiedState] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sorted = useMemo(() => [...links].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [links]);
  const canEmailInvite = Boolean(emailConfigured && clientEmail);
  const generatedMaskedUrl = generatedUrl ? maskPortalLink(generatedUrl) : null;

  async function refreshLinks() {
    const response = await fetch(`/api/portal?matterId=${encodeURIComponent(matterId)}`);
    const payload = await response.json().catch(() => null) as { links?: PortalLinkRecord[]; error?: string } | null;
    if (response.ok && payload?.links) setLinks(payload.links);
  }

  async function copyLink(url: string, successMessage = "Secure invite link copied.") {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedState(successMessage);
      setTimeout(() => setCopiedState(null), 2500);
    } catch {
      setMessage("Copy failed. Please try again in a browser with clipboard access.");
    }
  }

  async function generateLink() {
    setMessage(null);
    setGeneratedUrl(null);
    setCopiedState(null);
    if (!clientEmail) {
      setMessage("Add a client email or choose a linked matter before sending a portal invite.");
      return;
    }

    const response = await fetch("/api/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, matterId, label: "Client portal access" })
    });
    const payload = await response.json().catch(() => null) as { error?: string; portalUrl?: string; link?: string } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to create portal invite.");
      return;
    }

    setGeneratedUrl(payload?.portalUrl ?? payload?.link ?? null);
    setMessage(
      emailConfigured
        ? "Secure client portal invite created. Send it by email or copy the secure invite link."
        : "Email is not configured. Copy the secure invite link and send it manually."
    );
    await refreshLinks();
    startTransition(() => router.refresh());
  }

  async function patchLink(portalId: string, action: "revoke" | "regenerate" | "email") {
    setMessage(null);
    setGeneratedUrl(null);
    setCopiedState(null);
    if (action === "email" && !clientEmail) {
      setMessage("Add a client email or choose a linked matter before sending a portal invite.");
      return;
    }

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
      setMessage(payload?.error ?? "Unable to update portal invite.");
      return;
    }

    if (payload?.portalUrl) setGeneratedUrl(payload.portalUrl);
    setMessage(
      action === "revoke"
        ? "Portal invite revoked."
        : action === "email"
          ? (payload?.emailDelivery?.reason ?? "Portal invite sent.")
          : "Portal invite regenerated. Copy the new secure invite link before sharing it."
    );
    await refreshLinks();
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {!clientEmail ? (
        <SectionCard className="border-amber-400/20 bg-amber-400/10 p-4">
          <p className="text-sm font-semibold text-amber-100">Client email needed</p>
          <p className="mt-1 text-xs text-amber-50/90">Add a client email or choose a linked matter before sending a portal invite.</p>
        </SectionCard>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <GradientButton type="button" onClick={generateLink} disabled={isPending}>
          Create secure invite
        </GradientButton>
        <SubtleButton type="button" disabled={!generatedUrl} onClick={() => (generatedUrl ? copyLink(generatedUrl) : undefined)}>
          Copy secure invite link
        </SubtleButton>
        <SubtleButton type="button" disabled={!generatedUrl || !canEmailInvite} onClick={() => (sorted[0] ? patchLink(sorted[0].id, "email") : undefined)}>
          Send invite email
        </SubtleButton>
      </div>

      {!emailConfigured ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">Email is not configured. Copy the secure invite link and send it manually.</p>
      ) : null}

      {generatedMaskedUrl ? (
        <SectionCard className="space-y-3 p-4">
          <p className="text-sm font-semibold text-white">Secure invite ready</p>
          <p className="text-xs text-slate-400">The raw token is hidden here. Copy the secure invite link to share it with the client.</p>
          <p className="break-all rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-100">{generatedMaskedUrl}</p>
          <div className="flex flex-wrap gap-2">
            <SubtleButton type="button" onClick={() => generatedUrl ? copyLink(generatedUrl, "Secure invite link copied.") : undefined}>
              Copy secure invite link
            </SubtleButton>
            {canEmailInvite ? (
              <SubtleButton type="button" onClick={() => sorted[0] ? patchLink(sorted[0].id, "email") : undefined}>
                Send invite email
              </SubtleButton>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {message ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">{message}</p> : null}
      {copiedState ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-100">{copiedState}</p> : null}

      <div className="space-y-3">
        {sorted.length ? sorted.map((link) => (
          <SectionCard key={link.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{link.label}</p>
                <p className="mt-1 text-xs text-slate-400">{link.purpose ?? "CLIENT_PORTAL"} - Created {new Date(link.createdAt).toLocaleString("en-AU")}</p>
                <p className="mt-1 text-xs text-slate-500">Expires {new Date(link.expiresAt).toLocaleString("en-AU")}</p>
                {link.createdBy ? <p className="mt-1 text-xs text-slate-500">Generated by {link.createdBy.name ?? link.createdBy.email}</p> : null}
              </div>
              <StatusPill tone={link.status === "active" ? "success" : link.status === "expired" ? "warning" : "danger"}>{link.status}</StatusPill>
            </div>
            <div className="flex flex-wrap gap-2">
              <SubtleButton type="button" onClick={() => patchLink(link.id, "email")} disabled={isPending || !canEmailInvite}>Resend invite</SubtleButton>
              <SubtleButton type="button" onClick={() => patchLink(link.id, "regenerate")} disabled={isPending}>Regenerate invite</SubtleButton>
              <SubtleButton type="button" onClick={() => patchLink(link.id, "revoke")} disabled={isPending || link.status === "revoked"}>Revoke link</SubtleButton>
            </div>
            {link.lastViewedAt ? <p className="text-xs text-slate-500">Last used {new Date(link.lastViewedAt).toLocaleString("en-AU")}</p> : null}
          </SectionCard>
        )) : (
          <SectionCard className="p-4">
            <p className="text-sm text-slate-400">No client portal invites have been generated for this matter yet.</p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
