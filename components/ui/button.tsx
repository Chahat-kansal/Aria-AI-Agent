import { cn } from "@/lib/utils";

export function Button({ children, className }: { children: React.ReactNode; className?: string }) {
  return <button className={cn("rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90", className)}>{children}</button>;
}
