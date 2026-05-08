import { cn } from "@/lib/utils";

export function AppPage({
  children,
  className,
  contentClassName
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <main className={cn("app-shell-bg h-full min-h-screen text-[color:var(--text-primary)]", className)}>
      <div className={cn("mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10", contentClassName)}>
        {children}
      </div>
    </main>
  );
}
