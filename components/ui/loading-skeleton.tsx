import { cn } from "@/lib/utils";

export function LoadingSkeleton({
  className
}: {
  className?: string;
}) {
  return <div className={cn("animate-pulse rounded-[16px] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--surface-soft)_90%,transparent_10%),color-mix(in_srgb,var(--surface)_96%,transparent_4%),color-mix(in_srgb,var(--surface-soft)_90%,transparent_10%))] shadow-[var(--shadow-sm)]", className)} />;
}
