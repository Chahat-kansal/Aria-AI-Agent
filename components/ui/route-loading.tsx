import { AppShell } from "@/components/app/app-shell";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export function RouteLoading({
  title = "Loading",
  table = false,
  cards = 4
}: {
  title?: string;
  table?: boolean;
  cards?: number;
}) {
  return (
    <AppShell title={title}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <LoadingSkeleton className="h-3 w-28 rounded-full" />
            <LoadingSkeleton className="h-10 w-72 max-w-full rounded-[1rem]" />
            <LoadingSkeleton className="h-4 w-[32rem] max-w-full rounded-full" />
          </div>
          <LoadingSkeleton className="h-11 w-40 rounded-[1.2rem]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-32 rounded-[1.6rem]" />
          ))}
        </div>

        {table ? (
          <div className="space-y-3 rounded-[1.75rem] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)]">
            <LoadingSkeleton className="h-10 rounded-[1rem]" />
            {Array.from({ length: 6 }).map((_, index) => (
              <LoadingSkeleton key={index} className="h-14 rounded-[1rem]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingSkeleton key={index} className="h-40 rounded-[1.6rem]" />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
