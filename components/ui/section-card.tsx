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
        "app-surface rounded-[18px] p-5",
        className
      )}
    >
      {children}
    </section>
  );
}
