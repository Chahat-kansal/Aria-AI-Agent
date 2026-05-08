import { cn } from "@/lib/utils";

export function FormField({
  label,
  hint,
  error,
  children,
  className
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("space-y-2", className)}>
      <span className="block text-sm font-medium text-[color:var(--text-strong)]">{label}</span>
      {children}
      {error ? <span className="block text-sm text-rose-500 dark:text-rose-300">{error}</span> : null}
      {!error && hint ? <span className="block text-xs text-[color:var(--text-faint)]">{hint}</span> : null}
    </label>
  );
}
