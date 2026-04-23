import { NextResponse } from "next/server";
import { getDraftReviewData } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getMatterPathwayAnalyses } from "@/lib/services/pathway-analysis";
import { getVisaKnowledgeForAssistant } from "@/lib/services/visa-knowledge";
import { researchMigrationQuestion } from "@/lib/services/web-research";
import { prisma } from "@/lib/prisma";
import { canAccessMatter, hasPermission, scopedClientWhere, scopedMatterWhere } from "@/lib/services/roles";
import { aiNotConfiguredResponse, isAiConfigured } from "@/lib/services/ai-config";

function wantsLiveResearch(prompt: string) {
  return /\b(current|latest|today|recent|changed|official|web|internet|source|policy|news|update|visa rule|home affairs)\b/i.test(prompt);
}

function summarizeResearch(results: Awaited<ReturnType<typeof researchMigrationQuestion>>) {
  if (!results.configured) return results.setupMessage ?? "Live web research is not configured.";
  if (!results.results.length) return "No live official web results were returned for this question.";
  return results.results
    .slice(0, 3)
    .map((result) => `${result.sourceType === "official" ? "Official source" : "Public source"}: ${result.title} - ${result.content.slice(0, 240)}`)
    .join(" | ");
}

function sentenceList(items: string[]) {
  return items.filter(Boolean).slice(0, 6);
}

export async function POST(req: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
  if (!hasPermission(context.user, "can_access_ai")) return NextResponse.json({ error: "You do not have permission to use Aria AI." }, { status: 403 });
  if (!isAiConfigured()) return NextResponse.json(aiNotConfiguredResponse(), { status: 503 });

  const body = await req.json();
  const prompt = typeof body.prompt === "string" ? body.prompt : "Summarize current matter";
  const matterId = typeof body.matterId === "string" ? body.matterId : null;

  if (matterId) {
    const matter = await prisma.matter.findFirst({ where: { id: matterId, workspaceId: context.workspace.id }, include: { assignedToUser: true } });
    if (!matter || !canAccessMatter(context.user, matter)) return NextResponse.json({ error: "You do not have access to this matter." }, { status: 403 });
    const data = await getDraftReviewData(matterId);
    const impacts = await prisma.matterImpact.findMany({
      where: { matterId, status: { in: ["NEW", "REVIEWING"] } },
      include: { officialUpdate: true },
      orderBy: { createdAt: "desc" },
      take: 5
    });
    const openIssueTitles = data.openIssues.slice(0, 5).map((issue: any) => issue.title);
    const impactTitles = impacts.map((impact) => `${impact.officialUpdate.title}: ${impact.reason}`);
    const pathways = await getMatterPathwayAnalyses(matterId);
    const pathwaySummary = pathways
      .map((analysis) => `${analysis.title}: ${analysis.options[0]?.title ?? "evidence intake required"}`)
      .join(" | ");
    const visaKnowledge = await getVisaKnowledgeForAssistant(prompt);
    const research = wantsLiveResearch(prompt) ? await researchMigrationQuestion(prompt).catch((error) => ({
      provider: "error",
      configured: false,
      query: prompt,
      results: [],
      setupMessage: `Live research failed: ${error instanceof Error ? error.message : "unknown error"}`
    })) : null;
    const researchSummary = research ? summarizeResearch(research) : "Live web research was not requested for this answer.";

    return NextResponse.json({
      mode: "matter-specific",
      reviewRequired: true,
      content: `Aria reviewed this matter using stored draft, document, validation, pathway, visa knowledge, and update records. This is AI-assisted operational guidance only; final review remains with the registered migration agent.`,
      groundedFacts: sentenceList([
        `Draft readiness: ${data.draft.readinessScore}%.`,
        `Open validation items: ${openIssueTitles.length ? openIssueTitles.join("; ") : "none recorded"}.`,
        `Official update impacts: ${impactTitles.length ? impactTitles.join(" | ") : "none recorded"}.`,
        `Pathway context: ${pathwaySummary || "no linked pathway analysis recorded"}.`,
        `Stored visa knowledge: ${visaKnowledge.map((item) => item.title).join(" | ") || "no matching official visa knowledge stored"}.`,
        `Live research: ${researchSummary}.`
      ]),
      reasoning: sentenceList([
        data.openIssues.length ? "Prioritise unresolved validation issues before sending anything to the client." : "No stored validation blockers were found, but source-linked field verification is still required.",
        impacts.length ? "Review the flagged official update impacts before relying on current readiness." : "No stored official update impact currently changes this matter queue.",
        pathways.length ? "Use pathway analysis as scenario planning, not final legal advice." : "No linked pathway analysis is available for this matter."
      ]),
      citations: [
        { label: "Draft fields", href: `/app/matters/${matterId}/draft` },
        { label: "Validation issues", href: `/app/matters/${matterId}/draft` },
        { label: "Official update impacts", href: `/app/matters/${matterId}` },
        { label: "Pathway analyses", href: "/app/pathways" },
        { label: "Visa knowledge", href: "/app/knowledge" },
        ...(research?.results ?? []).slice(0, 3).map((result) => ({ label: result.title, href: result.url }))
      ],
      recommendedActions: impacts.length
        ? impacts.slice(0, 3).map((impact) => impact.actionRequired ?? "Review the source-linked official update against this matter.")
        : pathways.length
          ? pathways[0].options.slice(0, 3).flatMap((option) => Array.isArray(option.nextActionsJson) ? option.nextActionsJson.map(String).slice(0, 1) : [])
        : data.openIssues.length
          ? data.openIssues.slice(0, 3).map((issue: any) => issue.description)
          : ["Confirm all source-linked fields", "Review official update monitor", "Record final migration agent review"]
    });
  }

  const impacts = context
    ? await prisma.matterImpact.findMany({
        where: { matter: scopedMatterWhere(context.user), status: { in: ["NEW", "REVIEWING"] } },
        include: { matter: { include: { client: true } }, officialUpdate: true },
        orderBy: { createdAt: "desc" },
        take: 8
      })
    : [];
  const pathways = context
    ? await prisma.pathwayAnalysis.findMany({
        where: {
          workspaceId: context.workspace.id,
          OR: [
            { createdByUserId: context.user.id },
            { matter: scopedMatterWhere(context.user) },
            { client: scopedClientWhere(context.user) }
          ]
        },
        include: { client: true, matter: true, options: { orderBy: { rank: "asc" }, take: 2 } },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    : [];
  const pathwayLines = pathways.map((analysis) => `${analysis.title}: ${analysis.options[0]?.title ?? "evidence intake required"}`);
  const visaKnowledge = await getVisaKnowledgeForAssistant(prompt);
  const research = wantsLiveResearch(prompt) ? await researchMigrationQuestion(prompt).catch((error) => ({
    provider: "error",
    configured: false,
    query: prompt,
    results: [],
    setupMessage: `Live research failed: ${error instanceof Error ? error.message : "unknown error"}`
  })) : null;
  const researchSummary = research ? summarizeResearch(research) : "Live web research was not requested for this answer.";

  return NextResponse.json({
    mode: "workspace",
    reviewRequired: true,
    content: `Aria reviewed the workspace records available to your role and assignment scope. This answer is AI-assisted and review required; it does not make final legal decisions.`,
    groundedFacts: sentenceList([
      `${impacts.length} matter update impact alert(s) are flagged for review.`,
      `Recent pathway context: ${pathwayLines.join(" | ") || "no pathway analyses recorded"}.`,
      `Stored visa knowledge: ${visaKnowledge.map((item) => item.title).join(" | ") || "no matching official visa knowledge stored"}.`,
      `Live research: ${researchSummary}.`
    ]),
    reasoning: sentenceList([
      impacts.length ? "Start with update impact alerts because they may affect active matter assumptions." : "No update-impact queue is visible for your scope.",
      pathways.length ? "Review pathway analyses before giving client-facing pathway options." : "Create a pathway analysis only from real intake facts and evidence.",
      "Use linked sources and stored matter records before acting on any recommendation."
    ]),
    citations: [
      { label: "Official updates", href: "/app/updates" },
      { label: "Validation", href: "/app/validation" },
      { label: "Pathway Analysis", href: "/app/pathways" },
      { label: "Visa Knowledge", href: "/app/knowledge" },
      ...(research?.results ?? []).slice(0, 3).map((result) => ({ label: result.title, href: result.url }))
    ],
    recommendedActions: impacts.length
      ? impacts.slice(0, 3).map((impact) => `${impact.matter.client.firstName} ${impact.matter.client.lastName}: ${impact.actionRequired ?? impact.reason}`)
      : pathways.length
        ? pathways.slice(0, 3).map((analysis) => `Review ${analysis.title} before presenting pathway options to the client.`)
      : ["Run official source check when ingestion is enabled", "Review any newly flagged affected matters", "Confirm source-linked changes before updating submission readiness"]
  });
}
