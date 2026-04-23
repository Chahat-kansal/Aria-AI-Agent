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

  if (!isOpen) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-xl bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white shadow-premium transition hover:opacity-90"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          + Add Team Member
        </button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
        {inviteLink ? <a href={inviteLink} className="break-all text-sm text-accent">{inviteLink}</a> : null}
      </div>
    );
  }

  return (
    <form onSubmit={createUser} className="grid gap-3 rounded-2xl border border-border bg-white/45 p-4 md:grid-cols-2">
      <div className="md:col-span-2 flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">Add Team Member</h4>
          <p className="mt-1 text-xs text-muted">Create a staff invitation. The user sets their own password from the invite link.</p>
        </div>
        <button className="rounded-lg border border-border bg-white/60 px-3 py-2 text-xs text-muted hover:bg-white" onClick={() => setIsOpen(false)} type="button">Cancel</button>
      </div>
      <input name="name" required placeholder="Full name" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <input name="email" required type="email" placeholder="Work email" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <select name="role" required className="rounded-lg border border-border bg-white/70 p-2 text-sm">
        {roles.map((role) => <option key={role.role} value={role.role}>{role.label}</option>)}
      </select>
      <select name="visibilityScope" defaultValue="ASSIGNED_ONLY" className="rounded-lg border border-border bg-white/70 p-2 text-sm">
        <option value="ASSIGNED_ONLY">Assigned work only</option>
        <option value="TEAM_OVERSIGHT">Team oversight</option>
        <option value="FIRM_WIDE">Firm-wide visibility</option>
      </select>
      <input name="jobTitle" placeholder="Job title" className="rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <select name="supervisorId" defaultValue="" className="rounded-lg border border-border bg-white/70 p-2 text-sm">
        <option value="">No supervising user</option>
        {supervisors.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.email}</option>)}
      </select>
      <select name="status" defaultValue="INVITED" className="rounded-lg border border-border bg-white/70 p-2 text-sm" disabled>
        <option value="INVITED">Invited until password is set</option>
      </select>
      <textarea name="notes" placeholder="Internal access notes" className="min-h-24 rounded-lg border border-border bg-white/70 p-2 text-sm md:col-span-2" />
      <fieldset className="rounded-xl border border-border bg-white/50 p-3 md:col-span-2">
        <legend className="px-1 text-sm font-semibold">Feature permissions</legend>
        <p className="mb-3 text-xs text-muted">These toggles are stored per user. Company Owner accounts always keep every permission enabled.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {permissions.map((permission) => (
            <label key={permission.key} className="flex gap-3 rounded-lg border border-border bg-white/60 p-3 text-sm">
              <input name={permission.key} type="checkbox" defaultChecked={permission.key === "can_access_ai"} className="mt-1" />
              <span>
                <span className="block font-medium">{permission.label}</span>
                <span className="text-xs text-muted">{permission.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <button disabled={isSaving} className="rounded-lg bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? "Adding..." : "Add Team Member"}
        </button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </div>
    </form>
  );
}
