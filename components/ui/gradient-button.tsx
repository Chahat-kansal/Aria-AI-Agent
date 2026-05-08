import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type GradientButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
};

export const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  function GradientButton({ className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "app-purple-glow inline-flex h-11 items-center justify-center rounded-[1.2rem] bg-gradient-to-r from-[#6f31ef] via-[#8c56ff] to-[#7a3ff2] px-5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-violet-300/50 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
