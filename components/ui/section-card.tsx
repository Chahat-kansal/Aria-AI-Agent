import { cn } from "@/lib/utils";

export function SectionCard({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.9rem] border border-white/8 bg-[linear-gradient(180deg,rgba(11,15,23,0.94),rgba(12,17,27,0.9))] p-5 shadow-glass backdrop-blur-xl",
        className
      )}
    >
      {children}
    </section>
  );
}
