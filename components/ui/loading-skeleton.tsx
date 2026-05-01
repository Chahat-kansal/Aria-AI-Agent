import { cn } from "@/lib/utils";

export function LoadingSkeleton({
  className
}: {
  className?: string;
}) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/[0.06]", className)} />;
}
