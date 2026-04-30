import Link from "next/link";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Files,
  FolderKanban,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { VisaKnowledgeSearch } from "@/components/app/visa-knowledge-search";
import { canManageTeam, hasPermission, roleLabel, type PermissionKey } from "@/lib/services/roles";
import { UserRole } from "@prisma/client";
import { AppPage } from "@/components/ui/app-page";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";

const nav: Array<{
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionKey;
}> = [
  { label: "Overview", href: "/app/overview", icon: LayoutDashboard },
  { label: "Matters", href: "/app/matters", icon: BriefcaseBusiness },
  { label: "Client Intake", href: "/app/intake", icon: ClipboardCheck, permission: "can_send_client_requests" },
  { label: "Document Requests", href: "/app/document-requests", icon: FolderKanban, permission: "can_send_client_requests" },
  { label: "Appointments", href: "/app/appointments", icon: CalendarDays, permission: "can_manage_appointments" },
  { label: "Pathway Analysis", href: "/app/pathways", icon: Sparkles, permission: "can_run_pathway_analysis" },
  { label: "Visa Knowledge", href: "/app/knowledge", icon: Search, permission: "can_access_visa_knowledge" },
  { label: "Documents", href: "/app/documents", icon: Files },
  { label: "Forms & Field Review", href: "/app/forms", icon: FileText },
  { label: "Validation", href: "/app/validation", icon: ShieldCheck },
  { label: "Updates Monitor", href: "/app/updates", icon: Bell, permission: "can_access_update_monitor" },
  { label: "AI Assistant", href: "/app/assistant", icon: Sparkles, permission: "can_access_ai" },
  { label: "Tasks", href: "/app/tasks", icon: ClipboardCheck }
];

function SetupState({ title }: { title: string }) {
  return (
    <AppPage>
      <div className="flex min-h-[80vh] items-center justify-center">
        <GlassCard className="w-full max-w-2xl p-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Aria for Migration Agents</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            Your session is active, but this user is not linked to a workspace yet. Ask an administrator to add your account, or create a company workspace to begin.
          </p>
          <div className="mt-6">
            <Link href="/auth/sign-up" className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95">
              Set up workspace
            </Link>
          </div>
        </GlassCard>
      </div>
    </AppPage>
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
    { label: "Profile", href: "/app/profile", icon: Users },
    { label: "Company", href: "/app/company", icon: Building2 },
    { label: "Settings", href: "/app/settings", icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.25),transparent_34%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_32%),linear-gradient(135deg,#08111F,#0D1B2E_45%,#111827)] text-slate-50">
      <div className="mx-auto grid min-h-screen max-w-[1800px] gap-0 xl:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-slate-950/60 backdrop-blur-xl xl:min-h-screen xl:w-72 xl:border-b-0 xl:border-r">
          <div className="flex h-full flex-col p-5">
            <div className="space-y-4">
              <div>
                <p className="text-[2.2rem] font-semibold tracking-tight text-white">Aria</p>
                <p className="mt-1 text-lg text-slate-400">AI Migration Platform</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-400/20 text-cyan-200">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{workspace.name}</p>
                    <p className="text-xs text-slate-400">{roleLabel(user.role)}</p>
                  </div>
                </div>
              </div>
            </div>

            <nav className="mt-8 space-y-1">
              {shellNav.map((item) => {
                const Icon = item.icon;
                const active = title === item.label;

                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                      active
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {canOpenTeam ? (
              <div className="mt-5">
                <Link
                  href="/app/team"
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                    title === "Team" ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Users className="h-4 w-4" />
                  <span>Team</span>
                </Link>
              </div>
            ) : null}

            <div className="mt-auto space-y-4 pt-8">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Workspace scope</span>
                  <StatusPill tone="info">{canManageTeam(user) ? "Firm-wide" : "Assigned"}</StatusPill>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {canManageTeam(user)
                    ? `You are viewing ${workspace.plan.toLowerCase()} plan operations across the company workspace.`
                    : "You are seeing your assigned matters, tasks, and client operations only."}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b border-white/10 bg-white/[0.03] px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">
                {hasPermission(user, "can_access_visa_knowledge") ? (
                  <VisaKnowledgeSearch compact />
                ) : (
                  <div className="flex h-14 items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-500">
                    <Search className="h-5 w-5 text-slate-500" />
                    <span>Search is available when visa knowledge access is enabled.</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link href="/app/updates" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white">
                  <Bell className="h-5 w-5" />
                </Link>
                <Link href="/app/settings" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white">
                  <Settings className="h-5 w-5" />
                </Link>
                <Link href="/app/profile" className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 hover:bg-white/10">
                  {user.name} ({roleLabel(user.role)})
                </Link>
                <Link href="/auth/sign-out" className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 hover:bg-white/10">
                  Sign out
                </Link>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
