import { prisma } from "@/lib/prisma";
import { buildGroundedResponse, type AriaGroundedResponse } from "@/lib/services/aria-evidence";
import { draftPackHeading } from "@/lib/templates/visa-drafts";

function asList<T>(value: T[], limit = 8) {
  return value.slice(0, limit);
}

export async function generateVisaDraftPack(matterId: string): Promise<{
  supportedPack: string;
  content: string;
  grounded: AriaGroundedResponse;
}> {
  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: {
      client: true,
      documents: { orderBy: { createdAt: "desc" } },
      checklistItems: { orderBy: { label: "asc" } },
      validationIssues: { where: { resolutionStatus: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { createdAt: "desc" } },
      pathwayAnalyses: { include: { options: { orderBy: { rank: "asc" }, take: 3 } }, orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  const packName =
    matter.visaSubclass === "500" ? "500 Student" :
    matter.visaSubclass === "485" ? "485 Graduate" :
    matter.visaSubclass === "482" ? "482 TSS" :
    matter.visaSubclass === "186" ? "186 ENS" :
    ["820", "801", "820/801"].includes(matter.visaSubclass) ? "820/801 Partner" :
    ["309", "100", "309/100"].includes(matter.visaSubclass) ? "309/100 Partner" :
    ["189", "190", "491"].includes(matter.visaSubclass) ? "189/190/491 Skilled" :
    matter.visaSubclass === "600" ? "600 Visitor" :
    "Form 80 draft summary";

  const missingChecklist = matter.checklistItems.filter((item) => !item.documentId).map((item) => item.label);
  const warnings = [
    ...matter.validationIssues.map((issue) => issue.title),
    ...(missingChecklist.length ? ["Checklist evidence is still missing for one or more required items."] : [])
  ];

  const grounded = buildGroundedResponse({
    answer: `${packName} draft pack prepared from the current matter, checklist, and stored evidence records. Review required before any client-facing use.`,
    evidence: [
      {
        sourceType: "MATTER",
        sourceId: matter.id,
        title: `${matter.client.firstName} ${matter.client.lastName} - ${matter.title}`,
        snippet: `Subclass ${matter.visaSubclass}, stage ${matter.stage.toLowerCase()}.`,
        url: `/app/matters/${matter.id}`,
        confidence: 1,
        reliability: "AGENT_ENTERED"
      },
      ...asList(matter.documents, 4).map((document) => ({
        sourceType: "DOCUMENT" as const,
        sourceId: document.id,
        title: document.fileName,
        snippet: `${document.category} · ${document.extractionStatus.toLowerCase()}`,
        url: `/app/documents/${document.id}`,
        confidence: 0.72,
        reliability: "AI_EXTRACTED" as const
      })),
      ...asList(matter.pathwayAnalyses[0]?.options ?? [], 2).map((option) => ({
        sourceType: "SYSTEM" as const,
        title: option.title,
        snippet: option.relevance,
        url: `/app/pathways/${matter.pathwayAnalyses[0].id}`,
        confidence: option.confidence,
        reliability: "SYSTEM_DERIVED" as const
      }))
    ],
    assumptions: [
      "Only stored matter, checklist, document, and pathway records were used.",
      "Any declaration, health, criminal, signature, or eligibility conclusion still requires practitioner review."
    ],
    missingInformation: missingChecklist,
    confidence: missingChecklist.length ? 0.66 : 0.78,
    recommendedActions: [
      "Review the evidence list and resolve missing checklist items.",
      "Confirm all identifiers, dates, and declarations directly against source documents.",
      "Use the matter draft and official forms workspace before any client-facing finalisation."
    ],
    warnings
  });

  const content = [
    draftPackHeading(`${packName} draft pack`),
    "Matter summary",
    `- Client: ${matter.client.firstName} ${matter.client.lastName}`,
    `- Matter: ${matter.title}`,
    `- Subclass: ${matter.visaSubclass}`,
    `- Stage: ${matter.stage.replaceAll("_", " ")}`,
    "",
    "Evidence used",
    ...grounded.evidence.map((item) => `- ${item.title}${item.snippet ? `: ${item.snippet}` : ""}`),
    "",
    "Missing information",
    ...(grounded.missingInformation.length ? grounded.missingInformation.map((item) => `- [MISSING: ${item}]`) : ["- No additional missing fields were derived from the current checklist snapshot."]),
    "",
    "Warnings",
    ...(grounded.warnings.length ? grounded.warnings.map((item) => `- [STAFF REVIEW REQUIRED] ${item}`) : ["- [STAFF REVIEW REQUIRED] No additional warning was generated, but review is still required."]),
    "",
    "Recommended next actions",
    ...grounded.recommendedActions.map((item) => `- ${item}`),
    "",
    "Markers",
    "- [STAFF REVIEW REQUIRED]",
    "- [MISSING: field name]",
    "- [SOURCE REQUIRED]",
    "- [CLIENT CONFIRMATION REQUIRED]"
  ].join("\n");

  return {
    supportedPack: packName,
    content,
    grounded
  };
}
