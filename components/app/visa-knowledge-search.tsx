import { Search } from "lucide-react";

export function VisaKnowledgeSearch({ defaultValue = "", compact = false }: { defaultValue?: string; compact?: boolean }) {
  return (
    <form action="/app/knowledge" className={compact ? "flex min-w-full items-center gap-2 sm:min-w-[320px]" : "flex w-full flex-col gap-2 sm:flex-row"}>
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-white/70 px-3 py-2 text-sm text-muted">
        <Search className="h-4 w-4" />
        <input
          name="q"
          defaultValue={defaultValue}
          aria-label="Search visa knowledge"
          className="w-full bg-transparent p-0 text-sm"
          placeholder="Search subclass, visa name, pathway, evidence..."
        />
      </div>
      <button className="rounded-lg bg-gradient-to-r from-[#6D5EF6] to-[#19B6A3] px-4 py-2 text-sm font-semibold text-white">
        Search
      </button>
    </form>
  );
}
