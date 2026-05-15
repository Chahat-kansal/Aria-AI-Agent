"use client";

import { useState, useTransition } from "react";
import { GradientButton } from "@/components/ui/gradient-button";
import { SubtleButton } from "@/components/ui/subtle-button";
import { StatusPill } from "@/components/ui/status-pill";

type Props = {
  matterId: string;
  isAssignedAgent: boolean;
  confirmed: boolean;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
};

export function AgentClientFolderActions({ matterId, isAssignedAgent, confirmed, confirmedBy, confirmedAt }: Props) {
  const [isConfirmed, setIsConfirmed] = useState(confirmed);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirm = () => {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/matters/${matterId}/agent-client-folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof body.error === "string" ? body.error : "The private client folder could not be confirmed.");
        return;
      }
      setIsConfirmed(true);
      setMessage("Confirmed. The client folder is now visible to the assigned agent only.");
    });
  };

  if (!isAssignedAgent) {
    return (
      <div className="space-y-3">
        <StatusPill tone="warning">Assigned agent only</StatusPill>
        <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
          This private client folder is hidden from non-assigned users. Owners and admins can still use the separate secure export workflow when they have export permission, but this portal folder is for the assigned agent after confirmation.
        </p>
        {isConfirmed ? (
          <p className="text-xs text-[color:var(--text-muted)]">
            Confirmed{confirmedBy ? ` by ${confirmedBy}` : ""}{confirmedAt ? ` on ${confirmedAt}` : ""}.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={isConfirmed ? "success" : "warning"}>{isConfirmed ? "Confirmed" : "Confirmation required"}</StatusPill>
        <StatusPill tone="info">Assigned agent private</StatusPill>
      </div>
      <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
        Confirm before revealing the client-named folder. Aria records the confirmation, then generates the folder through a private permission-checked download so no extra ZIP copy sits exposed in storage.
      </p>
      {message ? <p className="rounded-2xl bg-[color:var(--surface-soft)] p-3 text-sm text-[color:var(--text-primary)]">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        {!isConfirmed ? (
          <GradientButton type="button" onClick={confirm} disabled={isPending}>
            {isPending ? "Confirming..." : "Confirm and reveal folder"}
          </GradientButton>
        ) : (
          <a href={`/api/matters/${matterId}/agent-client-folder`}>
            <GradientButton type="button">Download private client folder</GradientButton>
          </a>
        )}
        <SubtleButton type="button" disabled>
          Only assigned agent can open
        </SubtleButton>
      </div>
    </div>
  );
}
