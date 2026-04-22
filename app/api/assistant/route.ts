import { NextResponse } from "next/server";
import { getDraftReviewData } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
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

    return NextResponse.json({
      mode: "matter-specific",
      reviewRequired: true,
      content: `AI-assisted answer for: ${prompt}. Current draft readiness is ${data.draft.readinessScore}%. Open review items: ${openIssueTitles.join(", ") || "none recorded"}. Official update impacts flagged for review: ${impactTitles.join(" | ") || "none recorded"}. Registered migration agent review is required before client advice or submission preparation.`,
      citations: [
        { label: "Draft fields", href: `/app/matters/${matterId}/draft` },
        { label: "Validation issues", href: `/app/matters/${matterId}/draft` },
        { label: "Official update impacts", href: `/app/matters/${matterId}` }
      ],
      recommendedActions: impacts.length
        ? impacts.slice(0, 3).map((impact) => impact.actionRequired ?? "Review the source-linked official update against this matter.")
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

  return NextResponse.json({
    mode: "workspace",
    reviewRequired: true,
    content: `AI-assisted workspace answer for: ${prompt}. ${impacts.length} matter update impact alerts are currently flagged for review. No official guidance is fabricated; use the linked source records and practitioner review before action.`,
    citations: [
      { label: "Official updates", href: "/app/updates" },
      { label: "Validation", href: "/app/validation" }
    ],
    recommendedActions: impacts.length
      ? impacts.slice(0, 3).map((impact) => `${impact.matter.client.firstName} ${impact.matter.client.lastName}: ${impact.actionRequired ?? impact.reason}`)
      : ["Run official source check when ingestion is enabled", "Review any newly flagged affected matters", "Confirm source-linked changes before updating submission readiness"]
  });
}
