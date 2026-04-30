import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-3xl border border-white/10 bg-slate-950/55 p-5 text-slate-50 shadow-glass backdrop-blur-xl", className)}>{children}</section>;
}
