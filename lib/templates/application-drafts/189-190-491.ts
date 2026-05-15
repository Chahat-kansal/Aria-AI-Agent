import { createTemplate, englishSection, employmentSection, field, req, skillsSection, withCommonSections } from "./common";

const skilledPointsSection = {
  key: "skilled_points_eoi_roi",
  title: "Skilled points / EOI / ROI",
  fields: [
    field("skills.invitation_reference", "Invitation / SkillSelect reference", { sourceRequired: true }),
    field("nomination.state", "State nomination", { sourceRequired: true }),
    field("nomination.regional_support", "Regional nomination / sponsor evidence", { sourceRequired: true }),
    field("points.age", "Age points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.english", "English points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.overseas_employment", "Overseas employment points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.australian_employment", "Australian employment points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.australian_study", "Australian study points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.specialist_education", "Specialist education points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.partner", "Partner points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.naati", "NAATI / community language points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.professional_year", "Professional year points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.nomination", "Nomination points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" }),
    field("points.total", "Total claimed points", { sourceRequired: true, clientConfirmationCategory: "skilled_points" })
  ]
};

const skilledRequirements = [
  req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
  req("english", "English test", "Education", "REQUIRED", ["pte", "ielts", "toefl", "oet", "english"]),
  req("skills", "Skills assessment", "Employment", "REQUIRED", ["skills assessment", "assessing authority"]),
  req("cv", "Resume / CV", "Employment", "RECOMMENDED", ["resume", "cv"]),
  req("references", "Employment references", "Employment", "REQUIRED", ["employment reference", "reference"]),
  req("transcripts", "Academic transcripts", "Education", "RECOMMENDED", ["transcript", "academic record"]),
  req("points", "Points evidence", "Forms", "REQUIRED", ["points", "eoi", "skillselect"], undefined, "skilled_points"),
  req("form956", "Form 956", "Forms", "CONDITIONAL", ["form 956", "956", "agent"]),
  req("eoi_roi", "EOI / ROI connection evidence", "Forms", "CONDITIONAL", ["eoi", "roi", "registration of interest"], "EOI / ROI is not configured as a standalone flow unless the matter type exists.")
];

export const subclass189190491FullDraftTemplate = createTemplate(
  ["189", "190", "491", "491_FAMILY_SPONSORED", "EOI", "ROI"],
  "Skilled visa staff review application draft",
  [
    ...skilledRequirements,
    req("invitation", "Invitation letter / SkillSelect evidence", "Forms", "CONDITIONAL", ["invitation", "skillselect"]),
    req("nomination190", "State nomination letter", "Forms", "CONDITIONAL", ["state nomination", "nomination"]),
    req("nomination491", "Regional nomination / sponsor evidence", "Forms", "CONDITIONAL", ["regional nomination", "491 sponsor"])
  ],
  withCommonSections([englishSection, skillsSection, employmentSection, skilledPointsSection])
);
