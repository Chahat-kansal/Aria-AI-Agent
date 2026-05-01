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
      <span className="block text-sm font-medium text-slate-200">{label}</span>
      {children}
      {error ? <span className="block text-sm text-red-300">{error}</span> : null}
      {!error && hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
