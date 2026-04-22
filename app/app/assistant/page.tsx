import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { AssistantWorkspace } from "@/components/app/assistant-workspace";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getAssistantData, getMattersData } from "@/lib/data/workspace-repository";

const prompts = [
  "What is missing from this matter?",
  "Which uploaded documents support these draft fields?",
  "What conflicts still need review?",
  "What should I fix before sending to the client?",
  "Which matters may be impacted by recent updates?"
];

export default async function AssistantPage() {
  const context = await getCurrentWorkspaceContext();
  const threads = context ? await getAssistantData(context.workspace.id) : [];
  const matters = context ? await getMattersData(context.workspace.id) : [];

  return (
    <AppShell title="AI Assistant">
      <PageHeader title="AI Assistant Workspace" subtitle="Context-aware AI-assisted drafting with source-linked review-required actions." />
      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <h3 className="font-semibold">Matter-specific mode</h3>
          <div className="mt-3">
            <AssistantWorkspace matters={matters.map((matter) => ({ id: matter.id, label: `${matter.client.firstName} ${matter.client.lastName} · ${matter.title}` }))} />
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold">Suggested prompts</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">{prompts.map((prompt) => <li key={prompt} className="rounded-lg border border-border p-2">{prompt}</li>)}</ul>
          <h3 className="mt-5 font-semibold">Recent threads</h3>
          <div className="mt-3 space-y-2 text-sm text-muted">
            {threads.length ? threads.map((thread) => <div key={thread.id} className="rounded-lg border border-border p-2">{thread.title}</div>) : <p>No assistant threads are stored yet.</p>}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
