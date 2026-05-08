import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("app-surface-strong rounded-[2rem] p-6 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}
