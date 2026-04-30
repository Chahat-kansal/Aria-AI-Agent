import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-glass backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}
