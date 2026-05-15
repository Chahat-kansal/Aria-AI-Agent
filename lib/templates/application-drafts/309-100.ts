import { createTemplate, field, req, withCommonSections } from "./common";

const offshoreRelationshipSection = {
  key: "offshore_relationship_evidence",
  title: "Relationship / partner evidence",
  fields: [
    field("sponsor.full_name", "Sponsor name", { sourceRequired: true }),
    field("sponsor.status", "Sponsor citizenship / PR status", { sourceRequired: true }),
    field("sponsor.identity_evidence", "Sponsor identity evidence", { sourceRequired: true }),
    field("relationship.start_date", "Relationship start date", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("relationship.marriage_or_defacto_date", "Marriage / de facto date", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("relationship.cohabitation", "Living together evidence", { sourceRequired: true }),
    field("relationship.financial_evidence", "Financial evidence", { sourceRequired: true }),
    field("relationship.household_evidence", "Household evidence", { sourceRequired: true }),
    field("relationship.social_evidence", "Social evidence", { sourceRequired: true }),
    field("relationship.commitment_evidence", "Commitment evidence", { sourceRequired: true }),
    field("relationship.communication_history", "Communication history", { sourceRequired: true }),
    field("relationship.travel_visits", "Travel / visits", { sourceRequired: true }),
    field("relationship.financial_support", "Financial support", { sourceRequired: true }),
    field("relationship.timeline", "Relationship timeline", { sourceRequired: true, agentNarrative: true }),
    field("relationship.future_plans", "Future plans if client supplied", { unsafe: true, clientConfirmationCategory: "relationship_family" }),
    field("relationship.form_888", "Form 888 / witness support", { sourceRequired: true })
  ]
};

export const subclass309100FullDraftTemplate = createTemplate(
  ["309/100", "309", "100"],
  "Partner visa (Subclass 309/100) staff review application draft",
  [
    req("passport_applicant", "Passport - applicant", "Identity", "REQUIRED", ["passport", "applicant"]),
    req("passport_sponsor", "Passport / citizenship / PR evidence - sponsor", "Identity", "REQUIRED", ["sponsor", "citizenship", "passport", "permanent resident"]),
    req("marriage_defacto", "Marriage certificate or de facto evidence", "Relationship", "REQUIRED", ["marriage", "de facto", "relationship certificate"]),
    req("relationship", "Relationship evidence", "Relationship", "REQUIRED", ["relationship", "joint", "commitment"]),
    req("communication", "Communication/travel history", "Travel", "RECOMMENDED", ["communication", "message", "travel", "visit"]),
    req("support", "Financial support evidence", "Financial", "RECOMMENDED", ["financial support", "money transfer", "bank"]),
    req("form888", "Form 888 / witness statements", "Relationship", "RECOMMENDED", ["form 888", "witness", "statutory declaration"]),
    req("police", "Police clearance", "Health / Insurance", "CONDITIONAL", ["police", "afp", "clearance"], undefined, "character_declaration"),
    req("health", "Health examination", "Health / Insurance", "CONDITIONAL", ["health", "medical"], undefined, "health_declaration"),
    req("form956", "Form 956", "Forms", "CONDITIONAL", ["form 956", "956", "agent"])
  ],
  withCommonSections([offshoreRelationshipSection])
);
