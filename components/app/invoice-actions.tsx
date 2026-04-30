"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Printer, Send } from "lucide-react";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";

export function InvoiceActions({
  invoiceId,
  invoiceNumber,
  clientName,
  amountLabel,
  invoiceUrl,
  canSend,
  canManage
}: {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amountLabel: string;
  invoiceUrl: string;
  canSend: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function performAction(action: "markSent" | "markPaid" | "markCancelled" | "duplicate") {
    setPendingAction(action);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const result = await response.json().catch(() => null) as { error?: string; emailDelivery?: { delivered?: boolean; reason?: string } } | null;
    setPendingAction(null);
    if (!response.ok) {
      setError(result?.error ?? "Unable to update invoice status.");
      return;
    }
    setMessage(
      action === "markSent"
        ? result?.emailDelivery?.delivered
          ? "Invoice marked sent and email delivered."
          : result?.emailDelivery?.reason || "Invoice marked sent."
        : action === "markPaid"
          ? "Invoice marked paid."
          : action === "markCancelled"
            ? "Invoice cancelled."
            : "Invoice duplicated."
    );
    router.refresh();
  }

  async function handlePrint() {
    await fetch(`/api/invoices/${invoiceId}/download`, { method: "POST" }).catch(() => null);
    window.print();
  }

  async function copyInvoiceSummary() {
    const body = `Invoice ${invoiceNumber}\nClient: ${clientName}\nTotal: ${amountLabel}\nReview required before sending.\n${invoiceUrl}`;
    await navigator.clipboard.writeText(body);
    setMessage("Invoice summary copied.");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {canSend ? (
        <PrimaryButton type="button" onClick={() => performAction("markSent")} disabled={pendingAction !== null} className="gap-2">
          <Send className="h-4 w-4" />
          {pendingAction === "markSent" ? "Sending..." : "Send invoice"}
        </PrimaryButton>
      ) : null}
      {canManage ? (
        <>
          <SecondaryButton type="button" onClick={() => performAction("markPaid")} disabled={pendingAction !== null}>
            Mark paid
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => performAction("markCancelled")} disabled={pendingAction !== null}>
            Cancel
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => performAction("duplicate")} disabled={pendingAction !== null}>
            Duplicate
          </SecondaryButton>
        </>
      ) : null}
      <SecondaryButton type="button" onClick={handlePrint} className="gap-2">
        <Printer className="h-4 w-4" />
        Print / PDF
      </SecondaryButton>
      <SecondaryButton type="button" onClick={copyInvoiceSummary} className="gap-2">
        <Copy className="h-4 w-4" />
        Copy summary
      </SecondaryButton>
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
