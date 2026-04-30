import { cn } from "@/lib/utils";

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={cn("inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-300/40 disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...rest}
    />
  );
}
