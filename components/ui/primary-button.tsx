import { cn } from "@/lib/utils";

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={cn("inline-flex h-11 items-center justify-center rounded-[1.35rem] bg-gradient-to-r from-violet-500 via-violet-400 to-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_14px_48px_rgba(34,211,238,0.22)] transition hover:scale-[1.01] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...rest}
    />
  );
}
