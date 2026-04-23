"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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
      <label className="block text-xs font-medium text-muted" htmlFor="assignedToUserId">Assigned staff member</label>
      <select
        id="assignedToUserId"
        name="assignedToUserId"
        defaultValue={currentAssigneeId}
        className="w-full rounded-lg border border-border bg-white/70 p-2 text-sm"
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {(user.name ?? user.email)} - {user.roleLabel}
          </option>
        ))}
      </select>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
      <button
        className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Saving..." : "Update assignment"}
      </button>
    </form>
  );
}
