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
          "inline-flex h-10 items-center justify-center rounded-[10px] bg-[color:var(--surface-soft)] px-4 text-sm font-medium text-[color:var(--text-primary)] shadow-[var(--shadow-sm)] focus:outline-none focus:ring-2 focus:ring-violet-300/30 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
