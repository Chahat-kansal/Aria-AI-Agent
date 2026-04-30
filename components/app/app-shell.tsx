import { UserRole } from "@prisma/client";
import Link from "next/link";
import { AppPage } from "@/components/ui/app-page";
import { GlassCard } from "@/components/ui/glass-card";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam, hasPermission, roleLabel, type PermissionKey } from "@/lib/services/roles";
import { AppShellClient } from "@/components/app/app-shell-client";

const nav: Array<{
  label: string;
  href: string;
  icon:
    | "overview"
    | "matters"
    | "intake"
    | "documentRequests"
    | "appointments"
    | "pathways"
    | "knowledge"
    | "documents"
    | "forms"
    | "validation"
    | "updates"
    | "assistant"
    | "tasks"
    | "invoices";
  permission?: PermissionKey;
}> = [
  { label: "Overview", href: "/app/overview", icon: "overview" },
  { label: "Matters", href: "/app/matters", icon: "matters" },
  { label: "Client Intake", href: "/app/intake", icon: "intake", permission: "can_send_client_requests" },
  { label: "Document Requests", href: "/app/document-requests", icon: "documentRequests", permission: "can_send_client_requests" },
  { label: "Appointments", href: "/app/appointments", icon: "appointments", permission: "can_manage_appointments" },
  { label: "Pathway Analysis", href: "/app/pathways", icon: "pathways", permission: "can_run_pathway_analysis" },
  { label: "Visa Knowledge", href: "/app/knowledge", icon: "knowledge", permission: "can_access_visa_knowledge" },
  { label: "Documents", href: "/app/documents", icon: "documents" },
  { label: "Forms & Field Review", href: "/app/forms", icon: "forms" },
  { label: "Validation", href: "/app/validation", icon: "validation" },
  { label: "Invoices", href: "/app/invoices", icon: "invoices", permission: "can_view_invoices" },
  { label: "Updates Monitor", href: "/app/updates", icon: "updates", permission: "can_access_update_monitor" },
  { label: "AI Assistant", href: "/app/assistant", icon: "assistant", permission: "can_access_ai" },
  { label: "Tasks", href: "/app/tasks", icon: "tasks" }
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
    { label: "Profile", href: "/app/profile", icon: "profile" as const },
    { label: "Company", href: "/app/company", icon: "company" as const },
    { label: "Settings", href: "/app/settings", icon: "settings" as const },
    ...(canOpenTeam ? [{ label: "Team", href: "/app/team", icon: "team" as const }] : [])
  ];

  return (
    <AppShellClient
      userName={user.name}
      userRoleLabel={roleLabel(user.role)}
      workspaceName={workspace.name}
      workspacePlanLabel={`${workspace.plan.toLowerCase()} plan`}
      scopeLabel={canManageTeam(user) ? "Firm-wide" : "Assigned"}
      navItems={shellNav}
      canAccessVisaKnowledge={hasPermission(user, "can_access_visa_knowledge")}
    >
      {children}
    </AppShellClient>
  );
}
