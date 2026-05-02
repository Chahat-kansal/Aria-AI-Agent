import { AppShell } from "@/components/app/app-shell";
import { AssistantWorkspace } from "@/components/app/assistant-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getAssistantData, getMattersData } from "@/lib/data/workspace-repository";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { getAiConfigStatus } from "@/lib/services/runtime-config";

const prompts = [
  "Summarise the 189 vs 190 skilled visa distinction.",
  "Draft a client email about Form 80 updates.",
  "List 482 TSS nomination required documents.",
  "Explain partner visa relationship evidence tiers."
];

export default async function AssistantPage() {
  const context = await getCurrentWorkspaceContext();
  const aiConfig = getAiConfigStatus();
  if (context && !hasPermission(context.user, "can_access_ai")) {
    return (
      <AppShell title="AI Assistant">
        <div className="space-y-6">
          <PageHeader
            eyebrow="AI ASSISTANT"
            title="AI access unavailable"
            description="Your company administrator controls AI access for each staff user."
          />
          <SectionCard>
            <p className="text-sm leading-7 text-slate-300">
              You do not currently have permission to use Aria AI. Ask a Company Owner or Access Administrator to enable
              &quot;Access Aria AI&quot; for your account.
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
      <AssistantWorkspace
        matters={matters.map((matter) => ({ id: matter.id, label: `${matter.client.firstName} ${matter.client.lastName} - ${matter.title}` }))}
        suggestions={prompts}
        initialThreads={threads as any}
        aiConfigured={aiConfig.configured}
        aiSetupMessage={aiConfig.configured ? null : "AI is not configured. Add OPENAI_API_KEY and set AI_PROVIDER=openai to enable Aria responses."}
      />
    </AppShell>
  );
}
