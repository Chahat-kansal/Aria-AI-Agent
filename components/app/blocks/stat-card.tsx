import { StatCard as UiStatCard } from "@/components/ui/stat-card";

export function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <UiStatCard label={label} value={value} hint={hint} />;
}
