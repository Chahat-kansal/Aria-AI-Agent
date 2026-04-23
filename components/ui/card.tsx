import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("panel p-5 text-[#182033]", className)}>{children}</section>;
}
