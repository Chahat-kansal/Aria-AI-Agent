import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/services/platform-admin";

const nav = [
  ["/admin", "Overview"],
  ["/admin/workspaces", "Workspaces"],
  ["/admin/users", "Users"],
  ["/admin/security", "Security"],
  ["/admin/launch-controls", "Launch Controls"],
  ["/admin/system-health", "System Health"],
  ["/admin/audit", "Audit"],
  ["/admin/support", "Support"],
  ["/admin/billing", "Billing"],
  ["/admin/feature-flags", "Feature Flags"],
  ["/admin/subclass-support", "Subclass Support"],
  ["/admin/deployments", "Deployments"]
];

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = await requirePlatformAdmin();
  return (
    <main className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
      <div className="flex min-h-screen">
        <aside className="hidden h-screen w-72 shrink-0 overflow-y-auto p-4 lg:block">
          <div className="app-surface flex min-h-full flex-col rounded-[22px] p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-400">Aria Platform</p>
              <h1 className="mt-3 text-2xl font-semibold">Admin Console</h1>
              <p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">Sensitive client content is redacted by design.</p>
            </div>
            <nav className="mt-6 grid gap-1">
              {nav.map(([href, label]) => (
                <Link key={href} href={href as any} className="rounded-2xl px-3 py-2 text-sm text-[color:var(--text-secondary)] transition hover:bg-violet-500/10 hover:text-[color:var(--text-primary)]">
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto rounded-2xl bg-violet-500/10 p-3 text-xs text-[color:var(--text-secondary)]">
              <p className="font-semibold text-[color:var(--text-primary)]">{user.name}</p>
              <p className="mt-1 break-all">{user.email}</p>
            </div>
          </div>
        </aside>
        <section className="h-screen min-w-0 flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mb-5 rounded-2xl bg-amber-400/12 px-4 py-3 text-sm text-amber-600 dark:text-amber-200">
            Platform admin console. Sensitive client content is redacted by design.
          </div>
          <div className="mx-auto max-w-7xl space-y-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
