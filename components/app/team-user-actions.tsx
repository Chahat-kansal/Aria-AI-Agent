"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type PermissionDefinition = { key: string; label: string; description: string };
type RoleDefinition = { role: string; label: string };

export function TeamUserActions({
  userId,
  currentName,
  currentRole,
  currentJobTitle,
  currentStatus,
  isCompanyOwner,
  permissions,
  permissionDefinitions,
  roleDefinitions
}: {
  userId: string;
  currentName: string;
  currentRole: string;
  currentJobTitle: string | null;
  currentStatus: string;
  isCompanyOwner: boolean;
  permissions: Record<string, boolean>;
  permissionDefinitions: PermissionDefinition[];
  roleDefinitions: RoleDefinition[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
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

  async function resendInvite() {
    setPending(true);
    setMessage(null);
    setInviteLink(null);
    const response = await fetch(`/api/team/${userId}/invite`, { method: "POST" });
    const result = (await response.json().catch(() => null)) as { error?: string; inviteLink?: string; emailDelivery?: { delivered?: boolean; reason?: string } } | null;
    setPending(false);
    if (!response.ok) {
      setMessage(result?.error ?? "Unable to create a fresh invite link.");
      return;
    }
    setInviteLink(result?.inviteLink ?? null);
    setMessage(result?.emailDelivery?.delivered ? "Invite sent." : (result?.emailDelivery?.reason ?? "Invite link ready to share."));
    router.refresh();
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    await navigator.clipboard?.writeText(inviteLink);
    setMessage("Invite link copied.");
  }

  async function updatePermissions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? currentName),
      role: String(form.get("role") ?? currentRole),
      jobTitle: String(form.get("jobTitle") ?? ""),
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => setEditing((value) => !value)} className="inline-flex h-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-100 hover:bg-white/10 disabled:opacity-60">
          {editing ? "Close" : "Edit user"}
        </button>
        <button disabled={pending || isCompanyOwner} onClick={updateStatus} className="inline-flex h-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-100 hover:bg-white/10 disabled:opacity-60">
          {currentStatus === "DISABLED" ? "Activate" : "Deactivate"}
        </button>
        {currentStatus === "INVITED" ? (
          <button disabled={pending} onClick={resendInvite} className="inline-flex h-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-100 hover:bg-white/10 disabled:opacity-60">
            Resend invite
          </button>
        ) : null}
      </div>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
      {inviteLink ? (
        <div className="max-w-xs rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs">
          <a href={inviteLink} className="break-all text-cyan-300">{inviteLink}</a>
          <button onClick={copyInviteLink} className="mt-2 inline-flex h-8 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10" type="button">Copy invite link</button>
        </div>
      ) : null}
      {editing ? (
        <form className="min-w-[260px] rounded-3xl border border-white/10 bg-white/[0.04] p-4" onSubmit={updatePermissions}>
          <p className="mb-3 text-xs text-slate-400">{isCompanyOwner ? "Company Owner permissions are always on." : "Edit staff profile and feature permissions."}</p>
          <div className="mb-3 grid gap-2">
            <input name="name" defaultValue={currentName} placeholder="Full name" />
            <input name="jobTitle" defaultValue={currentJobTitle ?? ""} placeholder="Job title" />
            <select name="role" defaultValue={currentRole} disabled={isCompanyOwner}>
              {roleDefinitions.map((role) => <option key={role.role} value={role.role}>{role.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {permissionDefinitions.map((permission) => (
              <label key={permission.key} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs">
                <input name={permission.key} type="checkbox" defaultChecked={isCompanyOwner || permissions[permission.key] === true} disabled={isCompanyOwner} className="mt-1" />
                <span>
                  <span className="block font-medium text-white">{permission.label}</span>
                  <span className="text-slate-400">{permission.description}</span>
                </span>
              </label>
            ))}
          </div>
          <button disabled={pending || isCompanyOwner} className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 text-xs font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95 disabled:opacity-60">
            Save changes
          </button>
        </form>
      ) : null}
    </div>
  );
}
