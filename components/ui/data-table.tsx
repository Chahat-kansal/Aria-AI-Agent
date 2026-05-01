import { cn } from "@/lib/utils";

export function DataTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-[1.9rem] border border-white/8 bg-slate-950/45 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

export function DataTableHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <thead className={cn("bg-white/[0.02]", className)}>{children}</thead>;
}

export function DataTableHeading({ className, children }: { className?: string; children: React.ReactNode }) {
  return <th className={cn("px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500", className)}>{children}</th>;
}

export function DataTableRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tr className={cn("border-t border-white/5 transition hover:bg-white/[0.03]", className)}>{children}</tr>;
}

export function DataTableCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("px-4 py-3 text-sm text-slate-300", className)}>{children}</td>;
}
