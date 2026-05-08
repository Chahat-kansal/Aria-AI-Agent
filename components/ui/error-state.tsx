import { AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";

export function ErrorState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <SectionCard className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-red-400/12 text-red-300 shadow-[var(--shadow-sm)]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="page-title-display mt-4 text-[1.9rem] text-[color:var(--text-primary)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[color:var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </SectionCard>
  );
}
