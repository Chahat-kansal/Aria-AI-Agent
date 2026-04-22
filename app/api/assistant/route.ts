import { NextResponse } from "next/server";
import { generateSeededAiReply } from "@/lib/services/ai-adapter";
import { getDraftReviewData } from "@/lib/services/application-draft";

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = typeof body.prompt === "string" ? body.prompt : "Summarize current matter";
  const matterId = typeof body.matterId === "string" ? body.matterId : null;

  if (matterId) {
    const data = await getDraftReviewData(matterId);
    const openIssueTitles = data.openIssues.slice(0, 5).map((issue: any) => issue.title);
    return NextResponse.json({
      mode: "matter-specific",
      reviewRequired: true,
      content: `AI-assisted Subclass 500 draft answer for: ${prompt}. Current readiness is ${data.draft.readinessScore}%. Open review items: ${openIssueTitles.join(", ") || "none recorded"}. Registered migration agent review is required before client advice or submission preparation.`,
      citations: [
        { label: "Subclass 500 draft fields", href: `/app/matters/${matterId}/draft` },
        { label: "Validation issues", href: `/app/matters/${matterId}/draft` },
        { label: "Evidence package", href: `/app/matters/${matterId}/draft` }
      ],
      recommendedActions: data.openIssues.length
        ? data.openIssues.slice(0, 3).map((issue: any) => issue.description)
        : ["Prepare client review request", "Confirm all source-linked fields", "Record final migration agent review"]
    });
  }

  const reply = await generateSeededAiReply(prompt);

  return NextResponse.json({
    mode: "workspace",
    reviewRequired: true,
    ...reply
  });
}
