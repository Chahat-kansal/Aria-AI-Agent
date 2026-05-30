"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SubtleButton } from "@/components/ui/subtle-button";

export function AppointmentManager({
  appointmentId,
  currentStatus,
  calendarSyncLabel,
  canRetrySync
}: {
  appointmentId: string;
  currentStatus: "REQUESTED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  calendarSyncLabel?: string;
  canRetrySync?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function update(payload: Record<string, unknown>, successMessage: string) {
    setMessage(null);
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null) as { error?: string; calendarSync?: { state?: string; reason?: string | null } | null } | null;
    if (!response.ok) {
      setMessage(data?.error ?? "Unable to update appointment.");
      return;
    }
    const syncTail = data?.calendarSync?.state ? ` Calendar: ${String(data.calendarSync.state).replaceAll("_", " ").toLowerCase()}.` : "";
    setMessage(`${successMessage}${syncTail}`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canRetrySync ? <SubtleButton type="button" disabled={isPending} onClick={() => update({ calendarAction: "sync" }, "Calendar sync requested.")}>Sync now</SubtleButton> : null}
      {currentStatus !== "CONFIRMED" ? <SubtleButton type="button" disabled={isPending} onClick={() => update({ status: "CONFIRMED" }, "Appointment confirmed.")}>Confirm</SubtleButton> : null}
      {currentStatus !== "CANCELLED" ? <SubtleButton type="button" disabled={isPending} onClick={() => update({ status: "CANCELLED" }, "Appointment cancelled.")}>Cancel</SubtleButton> : null}
      {currentStatus !== "COMPLETED" ? <SubtleButton type="button" disabled={isPending} onClick={() => update({ status: "COMPLETED" }, "Appointment marked completed.")}>Complete</SubtleButton> : null}
      {calendarSyncLabel ? <p className="basis-full text-xs text-slate-500">Calendar: {calendarSyncLabel}</p> : null}
      {message ? <p className="basis-full text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
