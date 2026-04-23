import Link from "next/link";
import { Bell, Building2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { SignOutButton } from "@/components/app/sign-out-button";

const nav = [
  ["Overview", "/app/overview"],
  ["Matters", "/app/matters"],
  ["Pathway Analysis", "/app/pathways"],
  ["Visa Knowledge", "/app/knowledge"],
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
    <div className="min-h-screen p-6">
      <div className="panel mx-auto max-w-2xl p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria for Migration Agents</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-muted">
          Your sign-in session is active, but no workspace record is linked to this user yet. Create an account again or ask an administrator to add your user to a workspace.
        </p>
        <Link href="/auth/sign-up" className="mt-5 inline-flex rounded-lg bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white">
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
    <div className="min-h-screen">
      <div className="mx-auto grid max-w-[1680px] gap-4 p-3 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6 lg:p-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="panel p-4 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
          <div className="mb-6 space-y-3 border-b border-border pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria</p>
              <h2 className="mt-1 text-lg font-semibold">Migration Operations</h2>
            </div>
            <div className="flex w-full items-center justify-between rounded-lg border border-border bg-white/55 px-3 py-2 text-left text-sm">
              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" /> {workspace.name}</span>
              <span className="text-muted">v</span>
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:block lg:space-y-1">
            {nav.map(([label, href]) => (
              <Link key={href} href={href} className={cn("block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/70 hover:text-[#182033]", title === label && "bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] text-white shadow-premium")}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 rounded-lg border border-border bg-white/55 p-3 text-xs text-muted">
            Workspace plan: {workspace.plan}. AI-assisted workflows require practitioner review before use.
          </div>
        </aside>

        <main className="min-w-0">
          <header className="panel mb-4 flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-xl font-semibold">{title}</h1>
              <p className="text-sm text-muted">AI-assisted workflow. Review required before submission.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-full items-center gap-2 rounded-lg border border-border bg-white/60 px-3 py-2 text-sm text-muted sm:min-w-[300px]">
                <Search className="h-4 w-4" />
                Command/search: matters, fields, updates, tasks...
              </div>
              <button className="rounded-lg border border-border p-2"><Bell className="h-4 w-4" /></button>
              <div className="rounded-lg border border-border px-3 py-2 text-sm">{user.name} ({user.role})</div>
              <SignOutButton />
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
