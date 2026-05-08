import { cn } from "@/lib/utils";

export function DataTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("aria-table-wrap", className)}>
      {children}
    </div>
  );
}

export function DataTableHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <thead className={cn("aria-table-head", className)}>{children}</thead>;
}

export function DataTableHeading({ className, children }: { className?: string; children: React.ReactNode }) {
  return <th className={cn("aria-table-th", className)}>{children}</th>;
}

export function DataTableRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tr className={cn("aria-table-row transition", className)}>{children}</tr>;
}

export function DataTableCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("aria-table-td", className)}>{children}</td>;
}
