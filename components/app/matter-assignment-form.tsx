"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { GradientButton } from "@/components/ui/gradient-button";

type Assignee = {
  id: string;
  name: string | null;
  email: string;
  roleLabel: string;
};

export function MatterAssignmentForm({
  matterId,
  currentAssigneeId,
  users
}: {
  matterId: string;
  currentAssigneeId: string;
  users: Assignee[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);
    const assignedToUserId = String(formData.get("assignedToUserId") ?? "");

    const response = await fetch(`/api/matters/${matterId}/assignment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToUserId })
    });

    setIsSaving(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to update assignee.");
      return;
    }

    router.refresh();
  }

  return (
    <form className="mt-3 space-y-3" onSubmit={onSubmit}>
      <FormField label="Assigned staff member">
        <select
          id="assignedToUserId"
          name="assignedToUserId"
          defaultValue={currentAssigneeId}
          className="h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {(user.name ?? user.email)} - {user.roleLabel}
            </option>
          ))}
        </select>
      </FormField>
      {error ? <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
      <GradientButton type="submit" disabled={isSaving}>
        {isSaving ? "Saving..." : "Update assignment"}
      </GradientButton>
    </form>
  );
}
