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
    <main className={cn("min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.25),transparent_34%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_32%),linear-gradient(135deg,#08111F,#0D1B2E_45%,#111827)] text-slate-50", className)}>
      <div className={cn("mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8", contentClassName)}>
        {children}
      </div>
    </main>
  );
}
