import { cn } from "@/lib/utils";

export function Button({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <button
      className={cn(
        "app-purple-glow inline-flex h-11 items-center justify-center rounded-[10px] bg-[linear-gradient(180deg,var(--violet),var(--violet-600))] px-5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-violet-300/35 hover:-translate-y-[1px]",
        className
      )}
    >
      {children}
    </button>
  );
}
