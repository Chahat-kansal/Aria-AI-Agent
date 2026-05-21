import { buildPathwayGroundedResponse, pathwaySafetyDisclaimer, safePathwayText } from "../lib/services/pathway-analysis";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const forbidden = /you are eligible|best visa|will succeed|guaranteed|ready to lodge/i;
const cleaned = safePathwayText("You are eligible for the best visa and it will succeed. Ready to lodge.");

assert(!forbidden.test(cleaned), "Pathway safety sanitizer must remove forbidden outcome/advice wording.");
assert(pathwaySafetyDisclaimer.includes("Possible pathways for agent review"), "Safety disclaimer should use required pathway wording.");
assert(pathwaySafetyDisclaimer.includes("Registered migration agent review required"), "Safety disclaimer must require agent review.");

const grounded = buildPathwayGroundedResponse({
  id: "analysis-test",
  summary: `${pathwaySafetyDisclaimer} Evidence supports a skilled pathway comparison for review.`,
  assumptionsJson: ["Uses supplied facts only", "Official settings must be checked"],
  blockersJson: ["Invitation settings can change"],
  evidenceGapsJson: ["Skills assessment evidence", "English result"],
  options: [
    {
      id: "option-1",
      title: "Points-tested skilled pathway comparison",
      confidence: 0.72,
      relevance: "Occupation and English facts suggest review of skilled pathways.",
      missingJson: ["Skills assessment"]
    }
  ]
});

assert(grounded.evidence.length === 1, "Grounded response should include evidence references.");
assert(grounded.missingInformation.includes("Skills assessment evidence"), "Grounded response should keep missing information.");
assert(!forbidden.test(`${grounded.answer} ${grounded.evidence.map((item) => item.snippet).join(" ")}`), "Grounded pathway response must avoid forbidden wording.");

console.log("Pathway intelligence readiness passed.");
console.log(JSON.stringify({ evidence: grounded.evidence.length, confidence: grounded.confidence }, null, 2));
