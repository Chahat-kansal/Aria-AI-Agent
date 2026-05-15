import type { FullDraftDocumentRequirement, FullDraftSectionTemplate, FullDraftSupportLevel } from "@/lib/services/full-application-draft-types";
import { createTemplate, field, req, withCommonSections } from "./common";

export const activitySection: FullDraftSectionTemplate = {
  key: "activity_training_engagement",
  title: "Activity / training / engagement",
  description: "Activity facts must be grounded in sponsor, invitation, training, or engagement evidence.",
  fields: [
    field("activity.type", "Activity / training type", { sourceRequired: true }),
    field("activity.inviting_organisation", "Inviting / supporting organisation", { sourceRequired: true }),
    field("activity.training_plan", "Training plan / program", { sourceRequired: true, manualReview: true }),
    field("activity.start_date", "Activity start date", { sourceRequired: true }),
    field("activity.end_date", "Activity end date", { sourceRequired: true }),
    field("activity.location", "Activity location", { sourceRequired: true }),
    field("activity.specialist_work", "Specialist work evidence", { sourceRequired: true, manualReview: true }),
    field("activity.itinerary", "Itinerary / schedule", { sourceRequired: true })
  ]
};

export const parentChildSection: FullDraftSectionTemplate = {
  key: "parent_child_family_evidence",
  title: "Parent / child family evidence",
  description: "Family relationship claims are shown as source-backed review items, not legal conclusions.",
  fields: [
    field("family.sponsor_identity", "Sponsor identity / status", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("family.parent_child_relationship", "Parent-child relationship evidence", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("family.balance_of_family", "Balance of family evidence", { sourceRequired: true, manualReview: true, clientConfirmationCategory: "relationship_family" }),
    field("family.custody_responsibility", "Custody / parental responsibility", { sourceRequired: true, manualReview: true, clientConfirmationCategory: "relationship_family" }),
    field("family.adoption_evidence", "Adoption evidence if relevant", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("family.assurance_of_support", "Assurance of support if relevant", { sourceRequired: true, manualReview: true })
  ]
};

export const reviewResponseSection: FullDraftSectionTemplate = {
  key: "review_response_support_pack",
  title: "Review / response support pack",
  description: "Support-pack drafts organise evidence and chronology for agent review. They do not provide final legal advice.",
  fields: [
    field("review.decision_or_notice", "Decision / notice / request received", { sourceRequired: true, manualReview: true }),
    field("review.deadline", "Response or review deadline", { sourceRequired: true }),
    field("review.issue_summary", "Issue summary", { sourceRequired: true, manualReview: true, agentNarrative: true }),
    field("review.client_response", "Client response", { sourceRequired: true, clientConfirmationCategory: "document_accuracy", manualReview: true }),
    field("review.supporting_evidence", "Supporting evidence addressing issues", { sourceRequired: true, manualReview: true }),
    field("review.chronology", "Chronology", { sourceRequired: true, clientConfirmationCategory: "document_accuracy", manualReview: true }),
    field("review.outstanding_items", "Outstanding evidence / missing items", { sourceRequired: true }),
    field("review.submission_draft", "Agent submission draft sections", { agentNarrative: true, manualReview: true })
  ]
};

export const businessTalentSection: FullDraftSectionTemplate = {
  key: "business_talent_evidence",
  title: "Business / talent evidence",
  description: "Business and talent claims are source-backed preparation notes and remain agent-review required.",
  fields: [
    field("business.nomination_or_invitation", "Nomination / invitation evidence", { sourceRequired: true }),
    field("business.achievements", "Achievements / record of prominence", { sourceRequired: true, manualReview: true }),
    field("business.business_history", "Business / investment history", { sourceRequired: true, manualReview: true }),
    field("business.assets_turnover", "Assets / turnover evidence", { sourceRequired: true, manualReview: true }),
    field("business.endorsement", "Endorsement / nominator support", { sourceRequired: true }),
    field("business.statement", "Applicant statement / proposed activity", { sourceRequired: true, agentNarrative: true, manualReview: true })
  ]
};

export const sponsorshipVariantSection: FullDraftSectionTemplate = {
  key: "stream_variant_details",
  title: "Stream / variant details",
  description: "Variant-specific facts are surfaced for staff review and must remain source-backed.",
  fields: [
    field("stream.type", "Stream / variant", { fallback: "matter", sourceRequired: true }),
    field("stream.sponsor_or_nominator", "Sponsor / nominator", { sourceRequired: true }),
    field("stream.eligibility_basis", "Claimed eligibility basis", { sourceRequired: true, manualReview: true }),
    field("stream.conditions_or_limits", "Conditions, limits, or online-only constraints", { sourceRequired: true, manualReview: true, onlineOnly: true })
  ]
};

export function form956Req() {
  return req("form956", "Form 956 if agent appointed", "Forms", "CONDITIONAL", ["form 956", "956", "agent"]);
}

export function makeWorkflowTemplate(input: {
  codes: string[];
  title: string;
  supportLevel?: FullDraftSupportLevel;
  supportNotes?: string;
  documents: FullDraftDocumentRequirement[];
  sections: FullDraftSectionTemplate[];
}) {
  return createTemplate(
    input.codes,
    input.title,
    input.documents,
    withCommonSections(input.sections),
    input.supportLevel ?? "CHECKLIST_AND_INTAKE",
    input.supportNotes ?? "Preparation workflow configured with document matrix, intake confirmations, missing markers, and agent-review warnings. It is not labelled as full field-level automation unless a dummy full-draft readiness test passes."
  );
}
