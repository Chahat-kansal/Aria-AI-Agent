"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type RoleDefinition = { role: string; label: string; category: string; description: string };
type PermissionDefinition = { key: string; label: string; description: string };
type UserOption = { id: string; name: string; email: string };

export function TeamUserForm({ roles, supervisors, permissions }: { roles: RoleDefinition[]; supervisors: UserOption[]; permissions: PermissionDefinition[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setIsSaving(true);
    setMessage(null);
    setInviteLink(null);
    const form = new FormData(formElement);
    const payload: Record<string, unknown> = Object.fromEntries(form.entries());
    payload.permissions = permissions.reduce<Record<string, boolean>>((acc, permission) => {
      acc[permission.key] = form.has(permission.key);
      return acc;
    }, {});
    if (!payload.supervisorId) delete payload.supervisorId;

    const response = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as { error?: string; inviteLink?: string; emailDelivery?: { delivered?: boolean; reason?: string } } | null;
    setIsSaving(false);

    if (!response.ok) {
      setMessage(result?.error ?? "Unable to create staff user.");
      return;
    }

    setMessage(result?.emailDelivery?.delivered ? "Invite sent to staff member." : (result?.emailDelivery?.reason ?? "Invite created. Share the invite link with the staff member."));
    setInviteLink(result?.inviteLink ?? null);
    formElement.reset();
    setIsOpen(false);
    router.refresh();
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    await navigator.clipboard?.writeText(inviteLink);
    setMessage("Invite link copied.");
  }

  if (!isOpen) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          + Add Team Member
        </button>
        {message ? <p className="text-sm text-slate-400">{message}</p> : null}
        {inviteLink ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
            <p className="text-slate-400">Share this invite link:</p>
            <a href={inviteLink} className="break-all text-cyan-300">{inviteLink}</a>
            <button className="mt-2 inline-flex h-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-100 hover:bg-white/10 sm:ml-2 sm:mt-0" onClick={copyInviteLink} type="button">Copy invite link</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={createUser} className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-2">
      <div className="flex items-start justify-between gap-3 md:col-span-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">Add Team Member</h4>
          <p className="mt-1 text-xs text-slate-400">Create a staff invitation. The user sets their own password from the invite link.</p>
        </div>
        <button className="inline-flex h-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-100 hover:bg-white/10" onClick={() => setIsOpen(false)} type="button">Cancel</button>
      </div>
      <input name="name" required placeholder="Full name" />
      <input name="email" required type="email" placeholder="Work email" />
      <select name="role" required>
        {roles.map((role) => <option key={role.role} value={role.role}>{role.label}</option>)}
      </select>
      <select name="visibilityScope" defaultValue="ASSIGNED_ONLY">
        <option value="ASSIGNED_ONLY">Assigned work only</option>
        <option value="TEAM_OVERSIGHT">Team oversight</option>
        <option value="FIRM_WIDE">Firm-wide visibility</option>
      </select>
      <input name="jobTitle" placeholder="Job title" />
      <select name="supervisorId" defaultValue="">
        <option value="">No supervising user</option>
        {supervisors.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.email}</option>)}
      </select>
      <select name="status" defaultValue="INVITED" disabled>
        <option value="INVITED">Invited until password is set</option>
      </select>
      <textarea name="notes" placeholder="Internal access notes" className="md:col-span-2" />
      <fieldset className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:col-span-2">
        <legend className="px-1 text-sm font-semibold text-slate-100">Feature permissions</legend>
        <p className="mb-3 text-xs text-slate-400">These toggles are stored per user. Company Owner accounts always keep every permission enabled.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {permissions.map((permission) => (
            <label key={permission.key} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
              <input name={permission.key} type="checkbox" defaultChecked={permission.key === "can_access_ai"} className="mt-1" />
              <span>
                <span className="block font-medium text-white">{permission.label}</span>
                <span className="text-xs text-slate-400">{permission.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button disabled={isSaving} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95 disabled:opacity-60">
          {isSaving ? "Adding..." : "Add Team Member"}
        </button>
        {message ? <p className="text-sm text-slate-400">{message}</p> : null}
      </div>
    </form>
  );
}
