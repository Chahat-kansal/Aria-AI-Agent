import type { AriaEvidenceSource } from "@/lib/services/aria-evidence";

export type SkilledPointsBreakdown = {
  key: string;
  label: string;
  points: number;
  evidence: string[];
  assumptions: string[];
  missingEvidence: string[];
};

export type SkilledPointsResult = {
  total: number;
  reviewRequired: true;
  breakdown: SkilledPointsBreakdown[];
  evidence: AriaEvidenceSource[];
  warnings: string[];
};

function englishBand(level: string) {
  const lower = level.toLowerCase();
  if (/superior|ielts 8|pte 79/.test(lower)) return 20;
  if (/proficient|ielts 7|pte 65/.test(lower)) return 10;
  if (/competent|ielts 6|pte 50/.test(lower)) return 0;
  return 0;
}

function agePoints(age: number | null | undefined) {
  if (age == null) return 0;
  if (age >= 25 && age <= 32) return 30;
  if (age >= 18 && age <= 24) return 25;
  if (age >= 33 && age <= 39) return 25;
  if (age >= 40 && age <= 44) return 15;
  return 0;
}

export function calculateIndicativeSkilledPoints(profile: Record<string, unknown>): SkilledPointsResult {
  const age = typeof profile.age === "number" ? profile.age : null;
  const englishLevel = typeof profile.englishLevel === "string" ? profile.englishLevel : "Not provided";
  const location = typeof profile.location === "string" ? profile.location : "";
  const employerSponsorship = typeof profile.employerSponsorship === "string" ? profile.employerSponsorship : "";
  const familyStatus = typeof profile.familyStatus === "string" ? profile.familyStatus : "";

  const agePts = agePoints(age);
  const englishPts = englishBand(englishLevel);
  const regionalPoints = /regional|adelaide|perth|hobart|darwin|canberra|toowoomba|wollongong/i.test(location) ? 5 : 0;
  const nominationPoints = /190|state nomination|491|regional nomination|sponsor/i.test(`${employerSponsorship} ${familyStatus}`) ? 5 : 0;

  const breakdown: SkilledPointsBreakdown[] = [
    {
      key: "age",
      label: "Age",
      points: agePts,
      evidence: age != null ? [`Age supplied in pathway profile: ${age}.`] : [],
      assumptions: [],
      missingEvidence: age == null ? ["Date of birth or current age is missing."] : []
    },
    {
      key: "english",
      label: "English",
      points: englishPts,
      evidence: englishLevel !== "Not provided" ? [`English level supplied: ${englishLevel}.`] : [],
      assumptions: englishLevel !== "Not provided" ? ["Points are indicative until the actual test report is verified."] : [],
      missingEvidence: englishLevel === "Not provided" ? ["English test evidence or exemption basis is missing."] : []
    },
    {
      key: "regional",
      label: "Regional study/location",
      points: regionalPoints,
      evidence: regionalPoints ? [`Regional indicator detected from location: ${location}.`] : [],
      assumptions: regionalPoints ? ["Regional points depend on verified study/residence facts, not location text alone."] : [],
      missingEvidence: regionalPoints ? [] : ["Regional study or residence evidence is not clearly confirmed."] 
    },
    {
      key: "nomination",
      label: "Nomination / sponsor",
      points: nominationPoints,
      evidence: nominationPoints ? ["Profile mentions nomination or sponsor-related context."] : [],
      assumptions: nominationPoints ? ["Nomination-related points are indicative only until the actual state/family sponsorship basis is verified."] : [],
      missingEvidence: nominationPoints ? [] : ["Nomination or eligible sponsor evidence is not confirmed."] 
    }
  ];

  const total = breakdown.reduce((sum, item) => sum + item.points, 0);
  const warnings = [
    "This is an indicative points snapshot only, not a final eligibility decision.",
    "Skilled invitation settings and state criteria change frequently.",
    "Registered migration agent review is required before advising on 189, 190, 491, or ROI strategy."
  ];

  return {
    total,
    reviewRequired: true,
    breakdown,
    evidence: [
      {
        sourceType: "CLIENT_PROFILE",
        title: "Pathway analysis profile",
        snippet: "Indicative points were derived from the stored pathway profile fields only.",
        reliability: "CLIENT_SUPPLIED",
        confidence: 0.62
      }
    ],
    warnings
  };
}
