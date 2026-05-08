import { cn } from "@/lib/utils";

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={cn("inline-flex min-h-10 items-center justify-center rounded-[10px] bg-[color:var(--surface-soft)] px-4 py-2 text-center text-sm font-medium text-[color:var(--text-primary)] shadow-[var(--shadow-sm)] focus:outline-none focus:ring-2 focus:ring-violet-300/30 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...rest}
    />
  );
}
