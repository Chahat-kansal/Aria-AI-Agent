import { StatusPill } from "@/components/ui/status-pill";

export function StatusChip({ label }: { label: string }) {
  const key = label.toLowerCase();
  const tone =
    key === "high" || key === "critical" || key === "flagged" || key === "overdue"
      ? "danger"
      : key === "medium" || key === "reviewing" || key === "warning"
        ? "warning"
        : key === "verified" || key === "low" || key === "success" || key === "done"
          ? "success"
          : key === "info"
            ? "info"
            : "neutral";

  return <StatusPill tone={tone}>{label}</StatusPill>;
}
