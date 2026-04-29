import Link from "next/link";
import { Bell, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { VisaKnowledgeSearch } from "@/components/app/visa-knowledge-search";
import { canManageTeam, hasPermission, roleLabel, type PermissionKey } from "@/lib/services/roles";
import { UserRole } from "@prisma/client";

const nav: Array<{ label: string; href: string; permission?: PermissionKey }> = [
  { label: "Overview", href: "/app/overview" },
  { label: "Matters", href: "/app/matters" },
  { label: "Client Intake", href: "/app/intake", permission: "can_send_client_requests" },
  { label: "Document Requests", href: "/app/document-requests", permission: "can_send_client_requests" },
  { label: "Appointments", href: "/app/appointments", permission: "can_manage_appointments" },
  { label: "Pathway Analysis", href: "/app/pathways", permission: "can_run_pathway_analysis" },
  { label: "Visa Knowledge", href: "/app/knowledge", permission: "can_access_visa_knowledge" },
  { label: "Documents", href: "/app/documents" },
  { label: "Forms & Field Review", href: "/app/forms" },
  { label: "Validation", href: "/app/validation" },
  { label: "Updates Monitor", href: "/app/updates", permission: "can_access_update_monitor" },
  { label: "AI Assistant", href: "/app/assistant", permission: "can_access_ai" },
  { label: "Tasks", href: "/app/tasks" }
];

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
  const canOpenTeam = user.role === UserRole.COMPANY_OWNER || canManageTeam(user);
  const shellNav = [
    ...nav.filter((item) => !item.permission || hasPermission(user, item.permission)),
    { label: "Profile", href: "/app/profile" },
    { label: "Company", href: "/app/company" },
    { label: "Settings", href: "/app/settings" }
  ];

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
            {shellNav.map((item) => (
              <Link key={item.href} href={item.href as any} className={cn("block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/70 hover:text-[#182033]", title === item.label && "bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] text-white shadow-premium")}>
                {item.label}
              </Link>
            ))}
          </nav>
          {canOpenTeam ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 px-3 text-xs uppercase tracking-[0.18em] text-muted">Company</p>
              <Link href="/app/team" className={cn("block rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-white/70 hover:text-[#182033]", title === "Team" && "bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] text-white shadow-premium")}>
                Team
              </Link>
            </div>
          ) : null}
          <div className="mt-6 rounded-lg border border-border bg-white/55 p-3 text-xs text-muted">
            Workspace plan: {workspace.plan}. Active scope: {canManageTeam(user) ? "Company workspace" : "Assigned work"}.
          </div>
        </aside>

        <main className="min-w-0">
          <header className="panel mb-4 flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-xl font-semibold">{title}</h1>
              <p className="text-sm text-muted">AI-assisted workflow. Review required before submission.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {hasPermission(user, "can_access_visa_knowledge") ? <VisaKnowledgeSearch compact /> : null}
              <Link href="/app/updates" className="rounded-lg border border-border bg-white/50 p-2 text-muted hover:bg-white"><Bell className="h-4 w-4" /></Link>
              <Link href="/app/profile" className="rounded-lg border border-border bg-white/50 px-3 py-2 text-sm hover:bg-white">{user.name} ({roleLabel(user.role)})</Link>
              <Link href="/auth/sign-out" className="rounded-lg border border-border bg-white/50 px-3 py-2 text-sm text-muted transition hover:bg-white hover:text-[#182033]">Sign out</Link>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
