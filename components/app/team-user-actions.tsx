"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type PermissionDefinition = { key: string; label: string; description: string };

export function TeamUserActions({
  userId,
  currentStatus,
  isCompanyOwner,
  permissions,
  permissionDefinitions
}: {
  userId: string;
  currentStatus: string;
  isCompanyOwner: boolean;
  permissions: Record<string, boolean>;
  permissionDefinitions: PermissionDefinition[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const nextStatus = currentStatus === "DISABLED" ? "ACTIVE" : "DISABLED";

  async function updateStatus() {
    setPending(true);
    const response = await fetch(`/api/team/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    setPending(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error ?? "Unable to update user status.");
      return;
    }
    router.refresh();
  }

  async function updatePermissions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      permissions: permissionDefinitions.reduce<Record<string, boolean>>((acc, permission) => {
        acc[permission.key] = isCompanyOwner ? true : form.has(permission.key);
        return acc;
      }, {})
    };
    const response = await fetch(`/api/team/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setPending(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(result?.error ?? "Unable to update permissions.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => setEditing((value) => !value)} className="rounded-lg border border-border bg-white/50 px-3 py-2 text-xs text-muted hover:bg-white disabled:opacity-60">
          {editing ? "Close" : "Edit permissions"}
        </button>
        <button disabled={pending || isCompanyOwner} onClick={updateStatus} className="rounded-lg border border-border bg-white/50 px-3 py-2 text-xs text-muted hover:bg-white disabled:opacity-60">
          {currentStatus === "DISABLED" ? "Activate" : "Deactivate"}
        </button>
      </div>
      {message ? <p className="text-xs text-red-700">{message}</p> : null}
      {editing ? (
        <form className="min-w-[260px] rounded-xl border border-border bg-white/70 p-3" onSubmit={updatePermissions}>
          <p className="mb-2 text-xs text-muted">{isCompanyOwner ? "Company Owner permissions are always on." : "Toggle feature permissions for this staff account."}</p>
          <div className="space-y-2">
            {permissionDefinitions.map((permission) => (
              <label key={permission.key} className="flex gap-2 text-xs">
                <input name={permission.key} type="checkbox" defaultChecked={isCompanyOwner || permissions[permission.key] === true} disabled={isCompanyOwner} />
                <span>
                  <span className="block font-medium">{permission.label}</span>
                  <span className="text-muted">{permission.description}</span>
                </span>
              </label>
            ))}
          </div>
          <button disabled={pending || isCompanyOwner} className="mt-3 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
            Save permissions
          </button>
        </form>
      ) : null}
    </div>
  );
}
