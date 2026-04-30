"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Files,
  FolderKanban,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VisaKnowledgeSearch } from "@/components/app/visa-knowledge-search";
import { StatusPill } from "@/components/ui/status-pill";

type IconName =
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
  | "invoices"
  | "profile"
  | "company"
  | "settings"
  | "team";

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

const iconMap: Record<IconName, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  matters: BriefcaseBusiness,
  intake: ClipboardCheck,
  documentRequests: FolderKanban,
  appointments: CalendarDays,
  pathways: Sparkles,
  knowledge: Search,
  documents: Files,
  forms: FileText,
  validation: ShieldCheck,
  updates: Bell,
  assistant: Sparkles,
  tasks: ClipboardCheck,
  invoices: ReceiptText,
  profile: Users,
  company: Building2,
  settings: Settings,
  team: Users
};

const STORAGE_KEY = "aria.sidebar.collapsed";

function isActivePath(pathname: string, href: string) {
  if (href === "/app/overview") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShellClient({
  userName,
  userRoleLabel,
  workspaceName,
  workspacePlanLabel,
  scopeLabel,
  navItems,
  canAccessVisaKnowledge,
  children
}: {
  userName: string;
  userRoleLabel: string;
  workspaceName: string;
  workspacePlanLabel: string;
  scopeLabel: string;
  navItems: NavItem[];
  canAccessVisaKnowledge: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const shellNav = useMemo(() => navItems, [navItems]);

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-white/10 bg-slate-950/60 backdrop-blur-xl transition-[width,transform] duration-300",
        collapsed ? "w-24" : "w-72"
      )}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <div className={cn("min-w-0", collapsed && "sr-only")}>
          <p className="text-3xl font-semibold tracking-tight text-white">Aria</p>
          <p className="mt-1 text-sm text-slate-400">AI Migration Platform</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white xl:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 xl:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-400/20 text-cyan-200">
              <Building2 className="h-5 w-5" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{workspaceName}</p>
                <p className="text-xs text-slate-400">{userRoleLabel}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <nav className="space-y-1">
          {shellNav.map((item) => {
            const Icon = iconMap[item.icon];
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                  active ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-white",
                  collapsed && "justify-center"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="space-y-3">
          {!collapsed ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Workspace scope</span>
                <StatusPill tone="info">{scopeLabel}</StatusPill>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {workspacePlanLabel} plan operations are available inside this workspace.
              </p>
            </div>
          ) : (
            <div className="flex justify-center">
              <StatusPill tone="info">{scopeLabel}</StatusPill>
            </div>
          )}
          <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "justify-between")}>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{userName}</p>
                <p className="text-xs text-slate-400">{userRoleLabel}</p>
              </div>
            ) : null}
            <Link href="/auth/sign-out" className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-100 transition hover:bg-white/10">
              {collapsed ? "Out" : "Sign out"}
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.25),transparent_34%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_32%),linear-gradient(135deg,#08111F,#0D1B2E_45%,#111827)] text-slate-50">
      <div className="xl:hidden">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-4 backdrop-blur-xl">
          <div>
            <p className="text-lg font-semibold text-white">{workspaceName}</p>
            <p className="text-xs text-slate-400">{userRoleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
            <div className="h-full max-w-[20rem]">{sidebar}</div>
          </div>
        ) : null}
      </div>

      <div className={cn("mx-auto grid min-h-screen max-w-[1800px] gap-0", collapsed ? "xl:grid-cols-[96px_minmax(0,1fr)]" : "xl:grid-cols-[288px_minmax(0,1fr)]")}>
        <div className="hidden xl:block">{sidebar}</div>
        <main className="min-w-0">
          <div className="hidden border-b border-white/10 bg-white/[0.03] px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8 xl:block">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">
                {canAccessVisaKnowledge ? (
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
                  {userName} ({userRoleLabel})
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
