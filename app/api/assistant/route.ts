import { NextResponse } from "next/server";
import { getDraftReviewData } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getMatterPathwayAnalyses } from "@/lib/services/pathway-analysis";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = typeof body.prompt === "string" ? body.prompt : "Summarize current matter";
  const matterId = typeof body.matterId === "string" ? body.matterId : null;

  if (matterId) {
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

    return NextResponse.json({
      mode: "matter-specific",
      reviewRequired: true,
      content: `AI-assisted answer for: ${prompt}. Current draft readiness is ${data.draft.readinessScore}%. Open review items: ${openIssueTitles.join(", ") || "none recorded"}. Official update impacts flagged for review: ${impactTitles.join(" | ") || "none recorded"}. Pathway analysis context: ${pathwaySummary || "no linked pathway analysis recorded"}. Registered migration agent review is required before client advice or submission preparation.`,
      citations: [
        { label: "Draft fields", href: `/app/matters/${matterId}/draft` },
        { label: "Validation issues", href: `/app/matters/${matterId}/draft` },
        { label: "Official update impacts", href: `/app/matters/${matterId}` },
        { label: "Pathway analyses", href: "/app/pathways" }
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

  const context = await getCurrentWorkspaceContext();
  const impacts = context
    ? await prisma.matterImpact.findMany({
        where: { matter: { workspaceId: context.workspace.id }, status: { in: ["NEW", "REVIEWING"] } },
        include: { matter: { include: { client: true } }, officialUpdate: true },
        orderBy: { createdAt: "desc" },
        take: 8
      })
    : [];
  const pathways = context
    ? await prisma.pathwayAnalysis.findMany({
        where: { workspaceId: context.workspace.id },
        include: { client: true, matter: true, options: { orderBy: { rank: "asc" }, take: 2 } },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    : [];
  const pathwayLines = pathways.map((analysis) => `${analysis.title}: ${analysis.options[0]?.title ?? "evidence intake required"}`);

  return NextResponse.json({
    mode: "workspace",
    reviewRequired: true,
    content: `AI-assisted workspace answer for: ${prompt}. ${impacts.length} matter update impact alerts are currently flagged for review. Recent pathway context: ${pathwayLines.join(" | ") || "no pathway analyses recorded"}. No official guidance is fabricated; use linked source records and practitioner review before action.`,
    citations: [
      { label: "Official updates", href: "/app/updates" },
      { label: "Validation", href: "/app/validation" },
      { label: "Pathway Analysis", href: "/app/pathways" }
    ],
    recommendedActions: impacts.length
      ? impacts.slice(0, 3).map((impact) => `${impact.matter.client.firstName} ${impact.matter.client.lastName}: ${impact.actionRequired ?? impact.reason}`)
      : pathways.length
        ? pathways.slice(0, 3).map((analysis) => `Review ${analysis.title} before presenting pathway options to the client.`)
      : ["Run official source check when ingestion is enabled", "Review any newly flagged affected matters", "Confirm source-linked changes before updating submission readiness"]
  });
}
