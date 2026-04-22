import Link from "next/link";
import { Bell, Building2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";

const nav = [
  ["Overview", "/app/overview"],
  ["Matters", "/app/matters"],
  ["Documents", "/app/documents"],
  ["Forms & Field Review", "/app/forms"],
  ["Validation", "/app/validation"],
  ["Updates Monitor", "/app/updates"],
  ["AI Assistant", "/app/assistant"],
  ["Tasks", "/app/tasks"],
  ["Settings", "/app/settings"]
] as const;

function SetupState({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-[#040912] p-6">
      <div className="panel mx-auto max-w-2xl p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria for Migration Agents</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-muted">
          Your sign-in session is active, but no workspace record is linked to this user yet. Create an account again or ask an administrator to add your user to a workspace.
        </p>
        <Link href="/auth/sign-up" className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
          Set up workspace
        </Link>
      </div>
    </div>
  );
}

export async function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    return <SetupState title={title} />;
  }

  const { user, workspace } = context;

  return (
    <div className="min-h-screen bg-[#040912]">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[270px_1fr] gap-6 p-6">
        <aside className="panel h-[calc(100vh-3rem)] p-4">
          <div className="mb-6 space-y-3 border-b border-border pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria</p>
              <h2 className="mt-1 text-lg font-semibold">Migration Operations</h2>
            </div>
            <div className="flex w-full items-center justify-between rounded-xl border border-border bg-[#0e182a] px-3 py-2 text-left text-sm">
              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" /> {workspace.name}</span>
              <span className="text-muted">v</span>
            </div>
          </div>
          <nav className="space-y-1">
            {nav.map(([label, href]) => (
              <Link key={href} href={href} className={cn("block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-[#111a2b] hover:text-white", title === label && "bg-[#111a2b] text-white")}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 rounded-xl border border-border bg-[#0e182a] p-3 text-xs text-muted">
            Workspace plan: {workspace.plan}. AI-assisted workflows require practitioner review before use.
          </div>
        </aside>

        <main>
          <header className="panel mb-6 flex items-center justify-between p-4">
            <div>
              <h1 className="text-xl font-semibold">{title}</h1>
              <p className="text-sm text-muted">AI-assisted workflow. Review required before submission.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex min-w-[320px] items-center gap-2 rounded-lg border border-border bg-[#111a2b] px-3 py-2 text-sm text-muted">
                <Search className="h-4 w-4" />
                Command/search: matters, fields, updates, tasks...
              </div>
              <button className="rounded-lg border border-border p-2"><Bell className="h-4 w-4" /></button>
              <div className="rounded-lg border border-border px-3 py-2 text-sm">{user.name} ({user.role})</div>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
