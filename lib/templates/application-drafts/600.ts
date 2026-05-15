import { createTemplate, field, insuranceFundingSections, req, withCommonSections } from "./common";

const visitorSection = {
  key: "visitor_purpose_home_ties",
  title: "Visitor purpose / home ties",
  fields: [
    field("travel.arrival_date", "Intended arrival", { sourceRequired: true }),
    field("travel.departure_date", "Intended departure", { sourceRequired: true }),
    field("travel.purpose", "Purpose of visit", { sourceRequired: true, clientConfirmationCategory: "visitor_travel" }),
    field("travel.itinerary", "Itinerary", { sourceRequired: true }),
    field("travel.invitation_letter", "Invitation letter", { sourceRequired: true }),
    field("travel.accommodation", "Accommodation", { sourceRequired: true }),
    field("travel.australia_contact", "Family / friend details in Australia", { sourceRequired: true }),
    field("ties.employment", "Employment ties", { sourceRequired: true, clientConfirmationCategory: "visitor_travel" }),
    field("ties.study", "Study ties", { sourceRequired: true, clientConfirmationCategory: "visitor_travel" }),
    field("ties.family", "Family ties", { sourceRequired: true, clientConfirmationCategory: "visitor_travel" }),
    field("ties.property_business", "Property / business ties", { sourceRequired: true, clientConfirmationCategory: "visitor_travel" }),
    field("travel.previous_travel", "Previous travel / visa history", { sourceRequired: true }),
    field("travel.refusals_or_cancellations", "Refusals / cancellations if disclosed", { unsafe: true, clientConfirmationCategory: "character_declaration" })
  ]
};

export const subclass600FullDraftTemplate = createTemplate(
  ["600"],
  "Visitor visa (Subclass 600) staff review application draft",
  [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("bank", "Bank statements / financial evidence", "Financial", "REQUIRED", ["bank", "funds", "financial", "balance"], undefined, "financial_capacity"),
    req("employment", "Employer leave letter / employment evidence", "Employment", "RECOMMENDED", ["employer", "leave letter", "employment"]),
    req("accommodation", "Accommodation evidence", "Travel", "RECOMMENDED", ["accommodation", "hotel", "booking"]),
    req("itinerary", "Return ticket / travel itinerary if available", "Travel", "RECOMMENDED", ["itinerary", "ticket", "flight"]),
    req("invitation", "Invitation letter if applicable", "Travel", "CONDITIONAL", ["invitation", "host"]),
    req("home_ties", "Home ties evidence", "Employment", "RECOMMENDED", ["home ties", "property", "family", "business", "study"], undefined, "visitor_travel"),
    req("visa_history", "Previous travel / visa history", "Travel", "RECOMMENDED", ["previous travel", "visa history"]),
    req("form956", "Form 956", "Forms", "CONDITIONAL", ["form 956", "956", "agent"])
  ],
  withCommonSections([visitorSection, ...insuranceFundingSections])
);
