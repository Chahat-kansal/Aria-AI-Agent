import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type SubtleButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const SubtleButton = forwardRef<HTMLButtonElement, SubtleButtonProps>(
  function SubtleButton({ className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
