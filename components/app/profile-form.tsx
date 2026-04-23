"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(form.get("name") ?? "") })
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    setIsSaving(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to save profile.");
      return;
    }

    setMessage("Profile saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <label className="block text-sm font-medium">Display name</label>
      <input name="name" defaultValue={name} required className="w-full rounded-lg border border-border bg-white/70 p-2 text-sm" />
      <div className="flex items-center gap-3">
        <button disabled={isSaving} className="rounded-lg bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? "Saving..." : "Save profile"}
        </button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </div>
    </form>
  );
}
