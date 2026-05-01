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
  Activity,
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
  updates: Activity,
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

function SidebarNavSection({
  title,
  items,
  pathname,
  collapsed
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  if (!items.length) return null;

  return (
    <section className="space-y-2">
      {!collapsed ? <p className="px-3 text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">{title}</p> : null}
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = iconMap[item.icon];
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href as any}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-[1.15rem] px-3 py-2.5 text-sm transition",
                active ? "bg-cyan-500/10 text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
                collapsed && "justify-center px-0"
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-2 left-0 w-[3px] rounded-full bg-cyan-300 transition-opacity",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                )}
              />
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-cyan-300" : "text-slate-500 group-hover:text-cyan-300")} />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function AppShellClient({
  userName,
  userRoleLabel,
  workspaceName,
  workspacePlanLabel,
  scopeLabel,
  workspaceNavItems,
  accountNavItems,
  canAccessVisaKnowledge,
  children
}: {
  userName: string;
  userRoleLabel: string;
  workspaceName: string;
  workspacePlanLabel: string;
  scopeLabel: string;
  workspaceNavItems: NavItem[];
  accountNavItems: NavItem[];
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

  const topbarSearch = useMemo(() => {
    if (canAccessVisaKnowledge) {
      return <VisaKnowledgeSearch compact />;
    }

    return (
      <div className="flex h-14 items-center gap-3 rounded-[1.5rem] border border-white/8 bg-white/[0.03] px-4 text-sm text-slate-500">
        <Search className="h-5 w-5 text-slate-500" />
        <span>Search becomes available when visa knowledge access is enabled.</span>
      </div>
    );
  }, [canAccessVisaKnowledge]);

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-white/8 bg-[#070b11]/92 backdrop-blur-xl transition-[width,transform] duration-300",
        collapsed ? "w-24" : "w-72"
      )}
    >
      <div className="border-b border-white/6 px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("min-w-0", collapsed && "sr-only")}>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300">Aria OS</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Aria</h1>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="hidden h-10 w-10 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white xl:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-slate-300 xl:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn("mt-8 rounded-[1.75rem] border border-white/8 bg-white/[0.02] p-4", collapsed && "mt-5 p-3")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.45),transparent_50%),linear-gradient(180deg,rgba(12,34,41,0.9),rgba(18,20,30,0.95))] text-cyan-200">
              <Building2 className="h-5 w-5" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{workspaceName}</p>
                <p className="mt-1 text-xs text-slate-500">{workspacePlanLabel}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-6">
          <SidebarNavSection title="Workspace" items={workspaceNavItems} pathname={pathname} collapsed={collapsed} />
          <SidebarNavSection title="Account" items={accountNavItems} pathname={pathname} collapsed={collapsed} />
        </div>
      </div>

      <div className="border-t border-white/6 p-4">
        <div className={cn("space-y-3 rounded-[1.75rem] border border-white/8 bg-white/[0.02] p-4", collapsed && "p-3")}>
          {!collapsed ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{userName}</p>
                <p className="mt-1 text-xs text-slate-500">{userRoleLabel}</p>
              </div>
              <StatusPill tone="info">{scopeLabel}</StatusPill>
            </div>
          ) : (
            <div className="flex justify-center">
              <StatusPill tone="info">{scopeLabel}</StatusPill>
            </div>
          )}
          <Link
            href="/auth/sign-out"
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 hover:bg-white/[0.08]",
              collapsed && "w-full px-0"
            )}
          >
            {collapsed ? "Out" : "Sign out"}
          </Link>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_34%),linear-gradient(135deg,#05070b,#090e16_42%,#0d1622)] text-slate-50">
      <div className="xl:hidden">
        <div className="flex h-[88px] items-center justify-between border-b border-white/8 bg-[#06090d]/92 px-4 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-slate-300"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <StatusPill tone="info">{userRoleLabel}</StatusPill>
        </div>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
            <div className="h-full max-w-[22rem]">{sidebar}</div>
          </div>
        ) : null}
      </div>

      <div className={cn("mx-auto grid min-h-screen max-w-[1760px] xl:grid-cols-[288px_minmax(0,1fr)]", collapsed && "xl:grid-cols-[96px_minmax(0,1fr)]")}>
        <div className="hidden xl:block">{sidebar}</div>

        <main className="min-w-0">
          <div className="hidden h-[88px] items-center border-b border-white/8 bg-[#06090d]/80 px-6 backdrop-blur-xl xl:flex">
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-5">
              <div className="min-w-0">{topbarSearch}</div>
              <div className="flex items-center gap-3">
                <Link href="/app/updates" className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white">
                  <Bell className="h-5 w-5" />
                </Link>
                <Link href="/app/settings" className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white">
                  <Settings className="h-5 w-5" />
                </Link>
                <div className="flex items-center gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{workspaceName}</p>
                    <p className="text-xs text-slate-500">{userName}</p>
                  </div>
                  <StatusPill tone="info">{userRoleLabel}</StatusPill>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
