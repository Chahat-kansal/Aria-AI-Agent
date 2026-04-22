import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getAssistantData } from "@/lib/data/workspace-repository";

const prompts = [
  "What is missing from this matter?",
  "Summarize the current issues on this file",
  "Which matters may be impacted by recent updates?",
  "Draft a checklist for this client",
  "Explain this issue in plain English for internal review"
];

export default async function AssistantPage() {
  const context = await getCurrentWorkspaceContext();
  const threads = context ? await getAssistantData(context.workspace.id) : [];

  return (
    <AppShell title="AI Assistant">
      <PageHeader title="AI Assistant Workspace" subtitle="Context-aware AI-assisted drafting with source-linked review-required actions." />
      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <h3 className="font-semibold">Matter-specific mode</h3>
          <div className="mt-3 h-80 rounded-lg border border-border bg-[#0c1525] p-3 text-sm text-muted">
            {threads.length ? threads.map((thread) => (
              <div key={thread.id} className="mb-3 rounded-lg border border-border p-3">
                <p className="text-white">{thread.title}</p>
                <p className="text-xs">{thread.matter ? `${thread.matter.client.firstName} ${thread.matter.client.lastName}` : "Workspace thread"}</p>
                <p className="mt-2">{thread.messages[0]?.content ?? "No messages yet."}</p>
              </div>
            )) : (
              <p>No assistant threads are stored yet. Ask a matter-aware question after opening a real matter or draft workflow.</p>
            )}
          </div>
          <div className="mt-3 flex gap-2"><input className="w-full rounded-lg border border-border bg-[#0d1728] p-2" placeholder="Ask about readiness, issues, impacts, or tasks..." /><button className="rounded-lg bg-accent px-4 py-2 text-sm">Send</button></div>
        </Card>
        <Card>
          <h3 className="font-semibold">Suggested prompts</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">{prompts.map((prompt) => <li key={prompt} className="rounded-lg border border-border p-2">{prompt}</li>)}</ul>
        </Card>
      </section>
    </AppShell>
  );
}
