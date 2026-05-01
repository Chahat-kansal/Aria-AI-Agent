import { AppShell } from "@/components/app/app-shell";
import { AssistantWorkspace } from "@/components/app/assistant-workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getAssistantData, getMattersData } from "@/lib/data/workspace-repository";
import { hasPermission } from "@/lib/services/roles";

const prompts = [
  "Summarise this matter's missing evidence",
  "Draft a client email about missing documents",
  "Explain 189 vs 190 pathway considerations",
  "Review this matter for final cross-check blockers"
];

export default async function AssistantPage() {
  const context = await getCurrentWorkspaceContext();
  if (context && !hasPermission(context.user, "can_access_ai")) {
    return (
      <AppShell title="AI Assistant">
        <div className="space-y-6">
          <PageHeader eyebrow="AI ASSISTANT" title="AI access unavailable" description="Your company administrator controls AI access for each staff user." />
          <SectionCard>
            <p className="text-sm text-slate-300">
            You do not currently have permission to use Aria AI. Ask a Company Owner or Access Administrator to enable &quot;Access Aria AI&quot; for your account.
            </p>
          </SectionCard>
        </div>
      </AppShell>
    );
  }

  const threads = context ? await getAssistantData(context.workspace.id, context.user) : [];
  const matters = context ? await getMattersData(context.workspace.id, context.user) : [];

  return (
    <AppShell title="AI Assistant">
      <div className="space-y-8">
        <PageHeader
          eyebrow="AI ASSISTANT"
          title="How can Aria help today?"
          description="Ask matter-aware questions, review evidence gaps, compare pathways, and prepare review-required operational guidance grounded in live workspace data."
          action={<StatusPill tone="info">Review required</StatusPill>}
        />

        <PageSection title="Assistant workspace" description="Prompt Aria in workspace mode or scope the conversation to a specific matter.">
          <AssistantWorkspace
            matters={matters.map((matter) => ({ id: matter.id, label: `${matter.client.firstName} ${matter.client.lastName} - ${matter.title}` }))}
            suggestions={prompts}
          />
        </PageSection>

        <PageSection title="Recent threads" description="Stored assistant threads remain scoped to visible matters and workspace context.">
          {threads.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {threads.map((thread) => (
                <SectionCard key={thread.id} className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{thread.title}</p>
                    {thread.matter ? <StatusPill tone="info">{thread.matter.visaSubclass ?? "Matter"}</StatusPill> : null}
                  </div>
                  {thread.matter ? <p className="text-sm text-slate-400">{thread.matter.client.firstName} {thread.matter.client.lastName} · {thread.matter.title}</p> : <p className="text-sm text-slate-500">Workspace-wide thread</p>}
                  <p className="text-xs text-slate-500">{thread.messages[0]?.content?.slice(0, 140) ?? "No stored message content yet."}</p>
                </SectionCard>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No assistant threads yet"
              description="Ask Aria a workspace-aware question and the conversation history will start building here."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}
