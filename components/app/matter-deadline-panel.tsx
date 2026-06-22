import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { getMatterDeadlinePanel, type ScopedDeadlineUser } from "@/lib/services/deadlines/deadline-service";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export async function MatterDeadlinePanel(props: {
  workspaceId: string;
  user: ScopedDeadlineUser;
  matterId: string;
}) {
  const panel = await getMatterDeadlinePanel(props);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Matter deadline panel</h3>
          <p className="mt-2 text-xs text-slate-400">{panel.warning}</p>
        </div>
        <Link href={`/app/deadlines?matterId=${props.matterId}` as any} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-200">
          Open command centre
        </Link>
      </div>

      <div className="space-y-3">
        {panel.items.length ? panel.items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <StatusPill tone={item.urgency === "overdue" ? "danger" : item.urgency === "urgent" ? "warning" : "info"}>{item.urgency}</StatusPill>
                  <StatusPill tone={item.kind === "manual" ? "info" : "warning"}>{item.kind}</StatusPill>
                </div>
                {item.safeSummary ? <p className="mt-2 text-sm leading-6 text-slate-300">{item.safeSummary}</p> : null}
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>Due {formatDate(item.dueAt)}</p>
                <p className="mt-1">{item.daysUntil < 0 ? `${Math.abs(item.daysUntil)} day(s) overdue` : `${item.daysUntil} day(s)`}</p>
              </div>
            </div>
          </div>
        )) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
            No matter deadlines are active right now.
          </div>
        )}
      </div>
    </div>
  );
}
