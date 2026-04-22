import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";

const prompts = [
  "What is missing from this matter?",
  "Summarize the current issues on this file",
  "Which matters may be impacted by recent updates?",
  "Draft a checklist for this client",
  "Explain this issue in plain English for internal review"
];

export default function AssistantPage() {
  return (
    <AppShell title="AI Assistant">
      <PageHeader title="AI Assistant Workspace" subtitle="Context-aware AI-assisted drafting with citation panel and review-required actions." />
      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <h3 className="font-semibold">Matter-specific mode</h3>
          <div className="mt-3 h-80 rounded-lg border border-border bg-[#0c1525] p-3 text-sm text-muted">
            <p>Assistant: I found two unresolved issues for this file and one high-impact official update that may alter evidence requirements.</p>
            <p className="mt-2">Citations: Validation panel, Update monitor feed, Field review source snippets.</p>
            <p className="mt-2">Recommended actions: verify passport expiry, reconcile employment dates, update checklist.</p>
          </div>
          <div className="mt-3 flex gap-2"><input className="w-full rounded-lg border border-border bg-[#0d1728] p-2" placeholder="Ask about readiness, issues, impacts, or tasks..." /><button className="rounded-lg bg-accent px-4 py-2 text-sm">Send</button></div>
        </Card>
        <Card>
          <h3 className="font-semibold">Suggested prompts</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">{prompts.map((p) => <li key={p} className="rounded-lg border border-border p-2">{p}</li>)}</ul>
        </Card>
      </section>
    </AppShell>
  );
}
