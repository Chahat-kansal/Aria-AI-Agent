import { cn } from "@/lib/utils";

const toneMap: Record<string, string> = {
  high: "border-danger/40 bg-danger/10 text-danger",
  critical: "border-danger/50 bg-danger/15 text-danger",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-success/30 bg-success/10 text-success",
  verified: "border-success/30 bg-success/10 text-success",
  pending: "border-border bg-white/60 text-muted",
  flagged: "border-danger/40 bg-danger/10 text-danger",
  reviewing: "border-warning/40 bg-warning/10 text-warning"
};

export function StatusChip({ label }: { label: string }) {
  const key = label.toLowerCase();
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", toneMap[key] ?? "border-border bg-white/60 text-muted")}>{label}</span>;
}
