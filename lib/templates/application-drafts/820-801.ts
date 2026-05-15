import { createTemplate, field, req, withCommonSections } from "./common";

const relationshipSection = {
  key: "relationship_partner_evidence",
  title: "Relationship / partner evidence",
  fields: [
    field("sponsor.full_name", "Sponsor name", { sourceRequired: true }),
    field("sponsor.date_of_birth", "Sponsor DOB", { sourceRequired: true }),
    field("sponsor.status", "Sponsor citizenship / PR status", { sourceRequired: true }),
    field("sponsor.identity_evidence", "Sponsor identity evidence", { sourceRequired: true }),
    field("sponsor.address", "Sponsor address", { sourceRequired: true }),
    field("sponsor.contact", "Sponsor contact", { sourceRequired: true }),
    field("relationship.start_date", "Relationship start date", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("relationship.marriage_or_defacto_date", "Marriage / de facto date", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("relationship.cohabitation", "Living together evidence", { sourceRequired: true }),
    field("relationship.financial_evidence", "Financial evidence", { sourceRequired: true }),
    field("relationship.household_evidence", "Household evidence", { sourceRequired: true }),
    field("relationship.social_evidence", "Social evidence", { sourceRequired: true }),
    field("relationship.commitment_evidence", "Commitment evidence", { sourceRequired: true }),
    field("relationship.timeline", "Relationship timeline", { sourceRequired: true, agentNarrative: true }),
    field("relationship.separation_periods", "Separation periods", { unsafe: true, clientConfirmationCategory: "relationship_family" }),
    field("relationship.previous_relationships", "Previous relationships", { unsafe: true, clientConfirmationCategory: "relationship_family" }),
    field("relationship.form_888", "Form 888 / witness support", { sourceRequired: true }),
    field("relationship.family_friend_evidence", "Family / friend evidence", { sourceRequired: true })
  ]
};

export const subclass820801FullDraftTemplate = createTemplate(
  ["820/801", "820", "801"],
  "Partner visa (Subclass 820/801) staff review application draft",
  [
    req("passport_applicant", "Passport - applicant", "Identity", "REQUIRED", ["passport", "applicant"]),
    req("passport_sponsor", "Passport / citizenship / PR evidence - sponsor", "Identity", "REQUIRED", ["sponsor", "citizenship", "passport", "permanent resident"]),
    req("marriage_defacto", "Marriage certificate or de facto evidence", "Relationship", "REQUIRED", ["marriage", "de facto", "relationship certificate"]),
    req("joint_bank", "Joint bank statements", "Financial", "RECOMMENDED", ["joint bank", "bank statement"]),
    req("household", "Joint bills / household evidence", "Relationship", "RECOMMENDED", ["joint bill", "household", "lease"]),
    req("photos", "Relationship photographs", "Relationship", "RECOMMENDED", ["photo", "photograph"]),
    req("timeline", "Relationship timeline", "Statements / Declarations", "REQUIRED", ["timeline", "relationship statement"], undefined, "relationship_family"),
    req("form888", "Statutory declarations / Form 888", "Relationship", "RECOMMENDED", ["form 888", "statutory declaration", "witness"]),
    req("police", "Police clearance", "Health / Insurance", "CONDITIONAL", ["police", "afp", "clearance"], undefined, "character_declaration"),
    req("health", "Health examination", "Health / Insurance", "CONDITIONAL", ["health", "medical"], undefined, "health_declaration"),
    req("form956", "Form 956", "Forms", "CONDITIONAL", ["form 956", "956", "agent"])
  ],
  withCommonSections([relationshipSection])
);
