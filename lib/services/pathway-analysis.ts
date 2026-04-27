import { prisma } from "@/lib/prisma";
import { scopedClientWhere, scopedMatterWhere } from "@/lib/services/roles";
import { generateAriaAiResponse } from "@/lib/services/ai-provider";
import type { User } from "@prisma/client";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

export type PathwayProfileInput = {
  title?: string;
  matterId?: string;
  clientId?: string;
  currentVisaStatus?: string;
  age?: number;
  occupation?: string;
  anzscoCode?: string;
  studyHistory?: string;
  location?: string;
  familyStatus?: string;
  workExperience?: string;
  englishLevel?: string;
  employerSponsorship?: string;
  residenceHistory?: string;
  constraints?: string;
  freeText?: string;
};

type PathwayOptionInput = {
  pathwayType: "Immediate visa option" | "PR pathway" | "Citizenship consideration" | string;
  title: string;
  relevance: string;
  confidence: number;
  conditions: string[];
  missing: string[];
  risks: string[];
  nextActions: string[];
  rank?: number;
};

function includesAny(value: string | undefined, terms: string[]) {
  const lower = (value ?? "").toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function normalizeProfile(input: PathwayProfileInput) {
  return {
    currentVisaStatus: input.currentVisaStatus?.trim() || "Not provided",
    age: input.age ?? null,
    occupation: input.occupation?.trim() || "Not provided",
    anzscoCode: input.anzscoCode?.trim() || null,
    studyHistory: input.studyHistory?.trim() || "Not provided",
    location: input.location?.trim() || "Not provided",
    familyStatus: input.familyStatus?.trim() || "Not provided",
    workExperience: input.workExperience?.trim() || "Not provided",
    englishLevel: input.englishLevel?.trim() || "Not provided",
    employerSponsorship: input.employerSponsorship?.trim() || "Not provided",
    residenceHistory: input.residenceHistory?.trim() || "Not provided",
    constraints: input.constraints?.trim() || "Not provided",
    freeText: input.freeText?.trim() || "Not provided",
    reviewRequired: true
  };
}

function buildEvidenceGaps(profile: ReturnType<typeof normalizeProfile>) {
  const gaps = [];
  if (!profile.age) gaps.push("Date of birth or current age needs confirmation.");
  if (profile.occupation === "Not provided") gaps.push("Nominated occupation and ANZSCO alignment need review.");
  if (profile.englishLevel === "Not provided") gaps.push("English test status or exemption evidence is missing.");
  if (profile.workExperience === "Not provided") gaps.push("Skilled work history and supporting evidence are missing.");
  if (profile.residenceHistory === "Not provided") gaps.push("Residence history is required for longer-term PR/citizenship analysis.");
  if (profile.currentVisaStatus === "Not provided") gaps.push("Current visa status and expiry must be confirmed.");
  return gaps.length ? gaps : ["No major intake gaps identified from the supplied profile, but source evidence still needs migration agent review."];
}

function buildBlockers(profile: ReturnType<typeof normalizeProfile>) {
  const blockers = [];
  if (profile.age && profile.age >= 45) blockers.push("Age may limit some points-tested skilled PR pathways and needs careful review.");
  if (includesAny(profile.constraints, ["refusal", "cancel", "section 48", "character", "health"])) {
    blockers.push("Prior refusal, cancellation, health, character, or section 48 constraints were mentioned and require practitioner review.");
  }
  if (includesAny(profile.englishLevel, ["none", "low", "basic", "not"])) {
    blockers.push("English level may be below the threshold for stronger skilled pathways.");
  }
  if (profile.occupation === "Not provided") blockers.push("No nominated occupation is confirmed, which prevents reliable skilled pathway ranking.");
  return blockers.length ? blockers : ["No decisive blocker was identified from the intake, but the analysis is not a legal determination."];
}

function pathwayRules(profile: ReturnType<typeof normalizeProfile>) {
  const options: PathwayOptionInput[] = [];
  const studiesInAustralia = includesAny(`${profile.currentVisaStatus} ${profile.studyHistory}`, ["student", "subclass 500", "australia study", "australian study", "coe"]);
  const hasEmployer = includesAny(profile.employerSponsorship, ["yes", "sponsor", "employer", "nomination", "offer"]);
  const hasPartner = includesAny(profile.familyStatus, ["partner", "spouse", "de facto", "married"]);
  const regional = includesAny(profile.location, ["regional", "adelaide", "perth", "hobart", "darwin", "canberra", "toowoomba", "wollongong"]);
  const skilledReady = profile.occupation !== "Not provided" && !includesAny(profile.englishLevel, ["none", "low", "basic"]);
  const ageRisk = Boolean(profile.age && profile.age >= 45);

  if (studiesInAustralia) {
    options.push({
      pathwayType: "Immediate visa option",
      title: "Student-to-graduate transition review",
      relevance: "The profile mentions current or recent Australian study, so a graduate or further study strategy may be relevant before a PR pathway is ready.",
      confidence: 0.68,
      conditions: ["Confirm course completion status", "Confirm visa expiry and any study gaps", "Check current graduate visa policy settings before relying on this option"],
      missing: ["Completion letter/transcript", "Current visa grant and expiry", "English evidence if required"],
      risks: ["Policy settings and eligibility windows can change", "This may be a bridge strategy rather than a direct PR outcome"],
      nextActions: ["Upload current visa grant, CoE, completion evidence, and English results", "Run official update check before client-facing advice"]
    });
  }

  if (skilledReady && !ageRisk) {
    options.push({
      pathwayType: "PR pathway",
      title: "Points-tested skilled PR pathway comparison",
      relevance: "A nominated occupation, English profile, and work/study background can support review of Subclass 189, 190, or 491-style skilled pathways.",
      confidence: regional ? 0.74 : 0.69,
      conditions: ["Positive skills assessment pathway appears central", "Points score and state nomination criteria require current review", "Occupation list and invitation competitiveness must be checked"],
      missing: ["Skills assessment evidence", "English test result", "Detailed work references", "State nomination fit if considering 190/491"],
      risks: ["Invitation settings and state criteria change frequently", "Occupation may not be available for every pathway"],
      nextActions: ["Calculate points from source evidence", "Check current state/territory criteria", "Compare 189, 190, and 491 readiness"]
    });
  }

  if (hasEmployer) {
    options.push({
      pathwayType: "PR pathway",
      title: "Employer-sponsored pathway review",
      relevance: "Employer sponsorship context was supplied, so a temporary skilled pathway and possible employer-nominated PR pathway should be reviewed.",
      confidence: 0.72,
      conditions: ["Confirm sponsoring business eligibility", "Confirm occupation, salary, market salary, and work experience requirements", "Assess temporary-to-PR timing"],
      missing: ["Employer nomination details", "Position description", "Work experience evidence", "Salary and business documents"],
      risks: ["Employer eligibility and occupation settings are decisive", "A sponsor offer alone is not enough for PR"],
      nextActions: ["Request employer documents", "Review occupation against current skilled lists", "Map temporary and PR milestones separately"]
    });
  }

  if (hasPartner) {
    options.push({
      pathwayType: "PR pathway",
      title: "Partner/family pathway evidence review",
      relevance: "The intake indicates a partner or family context that may need separate assessment from skilled or study pathways.",
      confidence: 0.61,
      conditions: ["Relationship genuineness and sponsor eligibility require detailed evidence", "Onshore/offshore status and prior visa history must be checked"],
      missing: ["Relationship timeline", "Joint financial/social evidence", "Sponsor status evidence", "Prior relationship or dependent information"],
      risks: ["Insufficient relationship evidence can create review risk", "This pathway should not be mixed into skilled advice without separate practitioner review"],
      nextActions: ["Collect relationship evidence", "Confirm sponsor status", "Decide whether partner analysis should become a separate matter"]
    });
  }

  options.push({
    pathwayType: "Citizenship consideration",
    title: "Future citizenship eligibility tracking",
    relevance: "Citizenship is a later-stage consideration after permanent residence and residence-period checks, not an immediate visa outcome.",
    confidence: 0.55,
    conditions: ["PR must be achieved first unless another eligibility basis applies", "Residence, absences, character, and identity requirements need future tracking"],
    missing: ["Full residence history", "Travel movement history", "PR grant pathway and expected timing"],
    risks: ["Citizenship timing cannot be concluded from visa pathway facts alone", "Extended absences or character issues may affect eligibility"],
    nextActions: ["Maintain residence and travel history in the client file", "Review citizenship only after PR pathway assumptions are confirmed"]
  });

  if (!options.some((option) => option.pathwayType === "PR pathway")) {
    options.push({
      pathwayType: "PR pathway",
      title: "Preliminary PR eligibility triage",
      relevance: "The supplied profile does not yet support a stronger PR pathway ranking. A structured evidence intake is needed before advice is prepared.",
      confidence: 0.42,
      conditions: ["Confirm occupation, age, English, work history, and visa constraints", "Check whether skilled, employer, partner, or humanitarian/family routes are relevant"],
      missing: ["Occupation and skills profile", "English evidence", "Work and study chronology", "Current visa and expiry"],
      risks: ["Insufficient facts for reliable pathway ranking", "Human review is required before presenting options to the client"],
      nextActions: ["Complete intake", "Upload source documents", "Run pathway analysis again once evidence is available"]
    });
  }

  return options.sort((a, b) => b.confidence - a.confidence).map((option, index) => ({ ...option, rank: index + 1 }));
}

export async function createPathwayAnalysis(input: PathwayProfileInput & { workspaceId: string; createdByUserId: string }) {
  const profile = normalizeProfile(input);

  let options = pathwayRules(profile);
  let aiSummary: string | null = null;
  let aiBlockers: string[] | null = null;
  let aiEvidenceGaps: string[] | null = null;
  let aiAssumptions: string[] | null = null;

  const aiPathways = await generateAriaAiResponse({
    system: `
You are Aria, an AI migration workbench assisting registered migration agents.

Generate AI-assisted Australian visa pathway analysis.

Rules:
- Do not provide final legal advice.
- Do not guarantee eligibility or approval.
- Use review-required language.
- Use supplied facts only.
- If facts are missing, list them as evidence gaps.
- Return strict JSON:
{
  "summary": string,
  "options": [
    {
      "pathwayType": string,
      "title": string,
      "relevance": string,
      "confidence": number,
      "conditions": string[],
      "missing": string[],
      "risks": string[],
      "nextActions": string[]
    }
  ],
  "blockers": string[],
  "evidenceGaps": string[],
  "assumptions": string[]
}
`,
    user: "Generate pathway analysis from this client profile.",
    context: profile
  }).catch(() => null);

  if (aiPathways?.options && Array.isArray(aiPathways.options)) {
    options = aiPathways.options.map((option: any, index: number) => ({
      rank: index + 1,
      pathwayType: String(option.pathwayType || "PR pathway"),
      title: String(option.title || "Migration pathway for review"),
      relevance: String(option.relevance || "Requires registered migration agent review."),
      confidence: Number(option.confidence || 0.5),
      conditions: Array.isArray(option.conditions) ? option.conditions.map(String) : [],
      missing: Array.isArray(option.missing) ? option.missing.map(String) : [],
      risks: Array.isArray(option.risks) ? option.risks.map(String) : [],
      nextActions: Array.isArray(option.nextActions) ? option.nextActions.map(String) : []
    }));
  }

  if (typeof aiPathways?.summary === "string") {
    aiSummary = aiPathways.summary;
  }

  if (Array.isArray(aiPathways?.blockers)) {
    aiBlockers = aiPathways.blockers.map(String);
  }

  if (Array.isArray(aiPathways?.evidenceGaps)) {
    aiEvidenceGaps = aiPathways.evidenceGaps.map(String);
  }

  if (Array.isArray(aiPathways?.assumptions)) {
    aiAssumptions = aiPathways.assumptions.map(String);
  }

  const blockers = aiBlockers?.length ? aiBlockers : buildBlockers(profile);
  const evidenceGaps = aiEvidenceGaps?.length ? aiEvidenceGaps : buildEvidenceGaps(profile);

  const assumptions = aiAssumptions?.length
    ? aiAssumptions
    : [
        "This is AI-assisted scenario analysis for a registered migration agent to review.",
        "The analysis uses supplied intake facts and stored matter context only; it is not an eligibility decision or outcome prediction.",
        "Official criteria and policy settings should be checked before client-facing advice."
      ];

  const title = input.title?.trim() || `${profile.occupation !== "Not provided" ? profile.occupation : "Client"} pathway analysis`;

  const summary =
    aiSummary ||
    `${options.length} potential pathway group${options.length === 1 ? "" : "s"} identified for review. Strongest current option: ${options[0]?.title ?? "Evidence intake required"}. Review required before any recommendation.`;

  return prisma.pathwayAnalysis.create({
    data: {
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
      clientId: input.clientId || undefined,
      matterId: input.matterId || undefined,
      title,
      profileJson: profile,
      summary,
      assumptionsJson: assumptions,
      blockersJson: blockers,
      evidenceGapsJson: evidenceGaps,
      options: {
        create: options.map((option) => ({
          rank: option.rank ?? 1,
          pathwayType: option.pathwayType,
          title: option.title,
          relevance: option.relevance,
          confidence: option.confidence,
          conditionsJson: option.conditions,
          missingJson: option.missing,
          risksJson: option.risks,
          nextActionsJson: option.nextActions
        }))
      }
    },
    include: {
      client: true,
      matter: true,
      options: { orderBy: { rank: "asc" } }
    }
  });
}

export async function getPathwayAnalyses(workspaceId: string, user?: ScopedUser) {
  return prisma.pathwayAnalysis.findMany({
    where: user
      ? {
          workspaceId,
          OR: [
            { createdByUserId: user.id },
            { matter: scopedMatterWhere(user) },
            { client: scopedClientWhere(user) }
          ]
        }
      : { workspaceId },
    include: {
      client: true,
      matter: true,
      options: { orderBy: { rank: "asc" }, take: 3 },
      _count: { select: { options: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getPathwayAnalysisDetail(workspaceId: string, analysisId: string, user?: ScopedUser) {
  return prisma.pathwayAnalysis.findFirst({
    where: user
      ? {
          id: analysisId,
          workspaceId,
          OR: [
            { createdByUserId: user.id },
            { matter: scopedMatterWhere(user) },
            { client: scopedClientWhere(user) }
          ]
        }
      : { id: analysisId, workspaceId },
    include: {
      client: true,
      matter: true,
      createdByUser: true,
      options: { orderBy: { rank: "asc" } }
    }
  });
}

export async function getMatterPathwayAnalyses(matterId: string) {
  return prisma.pathwayAnalysis.findMany({
    where: { matterId },
    include: { options: { orderBy: { rank: "asc" }, take: 3 } },
    orderBy: { createdAt: "desc" },
    take: 3
  });
}