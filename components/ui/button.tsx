import { cn } from "@/lib/utils";

export function Button({ children, className }: { children: React.ReactNode; className?: string }) {
  return <button className={cn("rounded-lg bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white shadow-premium transition hover:-translate-y-0.5 hover:opacity-95", className)}>{children}</button>;
}
