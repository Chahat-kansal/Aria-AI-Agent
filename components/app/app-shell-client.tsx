"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Files,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Users,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VisaKnowledgeSearch } from "@/components/app/visa-knowledge-search";
import { StatusPill } from "@/components/ui/status-pill";
import { useTheme } from "@/components/theme-provider";

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
      {!collapsed ? (
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-tertiary)]">
          {title}
        </p>
      ) : null}
      <div className="space-y-1.5">
        {items.map((item) => {
          const Icon = iconMap[item.icon];
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href as any}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-[14px] px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-[linear-gradient(90deg,var(--violet-dim),rgba(255,255,255,0.01))] text-[color:var(--violet)] shadow-[var(--shadow-card)]"
                  : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]",
                collapsed && "justify-center px-0"
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-3 left-0 w-[3px] rounded-full bg-[color:var(--violet)] shadow-[0_0_14px_rgba(139,92,246,0.85)] transition-opacity duration-200",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                )}
              />
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-[color:var(--violet)]" : "text-[color:var(--text-tertiary)] group-hover:text-[color:var(--violet)]"
                )}
              />
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
  unreadNotificationCount,
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
  unreadNotificationCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

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

  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const topbarSearch = useMemo(() => {
    if (canAccessVisaKnowledge) {
      return (
        <div className="app-surface flex h-12 items-center rounded-[14px] px-3 shadow-none">
          <VisaKnowledgeSearch compact />
        </div>
      );
    }

    return (
      <div className="app-surface flex h-12 items-center gap-3 rounded-[14px] px-4 text-sm text-[color:var(--text-tertiary)] shadow-none">
        <Search className="h-4 w-4 text-[color:var(--text-tertiary)]" />
        <span>Quick search</span>
      </div>
    );
  }, [canAccessVisaKnowledge]);

  const sidebar = (
    <aside
      className={cn(
        "flex h-screen min-h-0 flex-col overflow-hidden px-4 py-5",
        collapsed ? "w-24" : "w-[17rem]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex min-w-0 items-center gap-3", collapsed && "justify-center")}>
          <div className="themed-logo-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[color:var(--text-primary)]">
                aria<span className="ml-1 text-[0.92rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--violet)]">Migration</span>
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">{workspacePlanLabel}</p>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="hidden h-10 w-10 items-center justify-center rounded-[12px] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:text-[color:var(--violet)] xl:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] shadow-[var(--shadow-sm)] xl:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className={cn("mt-5 rounded-[18px] bg-[color:var(--surface-soft)] p-3 shadow-[var(--shadow-sm)]", collapsed && "flex justify-center p-2.5")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[linear-gradient(135deg,var(--violet-dim),rgba(255,255,255,0.02))] text-[color:var(--violet)]">
            <Building2 className="h-4 w-4" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{workspaceName}</p>
              <p className="mt-0.5 text-[11px] text-[color:var(--text-tertiary)]">{scopeLabel} access</p>
            </div>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
        <div className="mt-4 flex h-12 items-center gap-3 rounded-[14px] bg-[color:var(--bg-input)] px-4 shadow-[var(--shadow-sm)]">
          <Search className="h-4 w-4 text-[color:var(--text-tertiary)]" />
          <span className="text-sm text-[color:var(--text-tertiary)]">Search clients, cases...</span>
        </div>
      ) : (
        <div className="mt-4 flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[color:var(--bg-input)] shadow-[var(--shadow-sm)]">
            <Search className="h-4 w-4 text-[color:var(--text-tertiary)]" />
          </div>
        </div>
      )}

      <div className="aria-sidebar-scroll mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-6 pb-4">
          <SidebarNavSection title="Workspace" items={workspaceNavItems} pathname={pathname} collapsed={collapsed} />
          <SidebarNavSection title="Account" items={accountNavItems} pathname={pathname} collapsed={collapsed} />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-[14px] bg-[color:var(--surface-soft)] p-1 shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-[10px] text-sm font-medium",
                theme === "light"
                  ? "bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] shadow-[var(--shadow-sm)]"
                  : "text-[color:var(--text-tertiary)]"
              )}
            >
              <SunMedium className="h-4 w-4" />
              {!collapsed ? "Light" : null}
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-[10px] text-sm font-medium",
                theme === "dark"
                  ? "bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] shadow-[var(--shadow-sm)]"
                  : "text-[color:var(--text-tertiary)]"
              )}
            >
              <Moon className="h-4 w-4" />
              {!collapsed ? "Dark" : null}
            </button>
          </div>
        </div>

        <div className={cn("rounded-[18px] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-card)]", collapsed && "p-2.5")}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3">
                <div className="themed-logo-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-sm font-semibold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{userName}</p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--text-tertiary)]">{userRoleLabel}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[color:var(--text-tertiary)]" />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-[12px] bg-[color:var(--surface-soft)] px-3 py-2.5">
                <div className="flex items-center gap-2 text-[11px] text-[color:var(--text-tertiary)]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--violet)]" />
                  {scopeLabel}
                </div>
                <Link href="/auth/sign-out" className="text-xs font-medium text-[color:var(--violet)]">
                  Sign out
                </Link>
              </div>
            </>
          ) : (
            <div className="flex justify-center">
              <div className="themed-logo-mark flex h-11 w-11 items-center justify-center rounded-[12px] text-sm font-semibold text-white">
                {initials}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="app-shell-bg h-screen overflow-hidden text-[color:var(--text-primary)]">
      <div className="xl:hidden">
        <div className="flex h-[78px] items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[color:var(--surface)] text-[color:var(--text-secondary)] shadow-[var(--shadow-card)]"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <StatusPill tone="info">{userRoleLabel}</StatusPill>
        </div>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-md">
            <div className="h-full max-w-[22rem]">{sidebar}</div>
          </div>
        ) : null}
      </div>

      <div className={cn("mx-auto grid h-screen max-w-[1800px] xl:grid-cols-[272px_minmax(0,1fr)]", collapsed && "xl:grid-cols-[96px_minmax(0,1fr)]")}>
        <div className="hidden h-screen xl:block">{sidebar}</div>

        <main className="min-w-0 h-screen overflow-y-auto overflow-x-hidden">
          <div className="sticky top-0 z-20 hidden px-8 pt-6 xl:block">
            <div className="flex items-center justify-between gap-5 rounded-[22px] bg-[color:var(--bg-glass)] px-6 py-4 shadow-[var(--shadow-sm)] backdrop-blur-xl">
              <div className="min-w-0 flex-1">{topbarSearch}</div>
              <div className="flex items-center gap-3">
                <Link href={"/app/settings/notifications" as any} className="relative inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[color:var(--surface)] text-[color:var(--text-secondary)] shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:text-[color:var(--violet)]">
                  <Bell className="h-5 w-5" />
                  {unreadNotificationCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--violet)] px-1.5 text-[10px] font-semibold text-white">
                      {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                    </span>
                  ) : null}
                </Link>
                <Link href="/app/settings" className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[color:var(--surface)] text-[color:var(--text-secondary)] shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:text-[color:var(--violet)]">
                  <Settings className="h-5 w-5" />
                </Link>
                <div className="flex items-center gap-3 rounded-[16px] bg-[color:var(--surface)] px-4 py-2.5 shadow-[var(--shadow-card)]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{workspaceName}</p>
                    <p className="text-xs text-[color:var(--text-tertiary)]">{userName}</p>
                  </div>
                  <StatusPill tone="info">{userRoleLabel}</StatusPill>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-10 xl:pt-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
