import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "app-surface-strong rounded-[18px] p-6 text-[color:var(--text-primary)] sm:p-7",
        className
      )}
    >
      {children}
    </section>
  );
}
