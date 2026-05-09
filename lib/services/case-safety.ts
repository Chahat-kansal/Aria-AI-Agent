import { DraftFieldStatus, IssueSeverity, ReviewRequestStatus } from "@prisma/client";
import { getDraftReviewData } from "@/lib/services/application-draft";
import { buildMatterClientConfirmationItems } from "@/lib/services/client-confirmation";
import { prisma } from "@/lib/prisma";
import { decryptJson } from "@/lib/security/encryption";

const UNSAFE_FIELD_KEYS = new Set([
  "statement.genuine_student",
  "health.declarations",
  "character.declarations",
  "signature.client_signature"
]);

function isUnsafeField(field: any) {
  if (UNSAFE_FIELD_KEYS.has(field.templateField.fieldKey)) return true;
  const validationRules = field.templateField.validationRules as Record<string, unknown> | null | undefined;
  return Boolean(validationRules?.unsafe);
}

type CaseSafetyBlocker = {
  severity: "HARD" | "SOFT";
  code: string;
  title: string;
  detail: string;
  relatedFieldKey?: string;
};

export type CaseSafetyAssessment = {
  matterId: string;
  draftId: string;
  readinessScore: number;
  hardBlockers: CaseSafetyBlocker[];
  softBlockers: CaseSafetyBlocker[];
  recommendedActions: string[];
  readyForAgentFinalReview: boolean;
  reviewRequestState: {
    sent: boolean;
    confirmed: boolean;
    latestStatus: ReviewRequestStatus | null;
  };
};

function buildBlocker(
  severity: "HARD" | "SOFT",
  code: string,
  title: string,
  detail: string,
  relatedFieldKey?: string
): CaseSafetyBlocker {
  return { severity, code, title, detail, relatedFieldKey };
}

export async function assessMatterCaseSafety(matterId: string): Promise<CaseSafetyAssessment> {
  const reviewData = await getDraftReviewData(matterId);
  const [latestIntake, clientConfirmationItems] = await Promise.all([
    prisma.clientIntakeRequest.findFirst({
      where: { matterId },
      orderBy: { createdAt: "desc" }
    }),
    buildMatterClientConfirmationItems(matterId).catch(() => [])
  ]);
  const hardBlockers: CaseSafetyBlocker[] = [];
  const softBlockers: CaseSafetyBlocker[] = [];

  const requiredFields = reviewData.draft.fields.filter((field: any) => field.templateField.required);

  for (const field of requiredFields) {
    const fieldKey = field.templateField.fieldKey;
    const fieldLabel = field.templateField.label;

    if (field.status === DraftFieldStatus.MISSING) {
      hardBlockers.push(
        buildBlocker(
          "HARD",
          "required_field_missing",
          `Missing required field: ${fieldLabel}`,
          `${fieldLabel} does not yet have a trusted mapped value.`,
          fieldKey
        )
      );
      continue;
    }

    if (field.status === DraftFieldStatus.CONFLICTING) {
      hardBlockers.push(
        buildBlocker(
          "HARD",
          "required_field_conflict",
          `Conflicting evidence for ${fieldLabel}`,
          `${fieldLabel} is supported by conflicting evidence and cannot be treated as stable.`,
          fieldKey
        )
      );
      continue;
    }

    if (isUnsafeField(field) && field.status !== DraftFieldStatus.VERIFIED) {
      hardBlockers.push(
        buildBlocker(
          "HARD",
          "unsafe_field_unverified",
          `${fieldLabel} still needs explicit review`,
          `Sensitive declarations, statements, and signature-adjacent fields must be explicitly reviewed before client-facing use.`,
          fieldKey
        )
      );
      continue;
    }

    if (field.status === DraftFieldStatus.NEEDS_REVIEW) {
      softBlockers.push(
        buildBlocker(
          "SOFT",
          "required_field_needs_review",
          `${fieldLabel} still needs agent review`,
          `${fieldLabel} has a mapped value but remains review-required before it should be relied upon.`,
          fieldKey
        )
      );
    }
  }

  const byFieldKey = new Map<string, any>(reviewData.draft.fields.map((field: any) => [field.templateField.fieldKey, field]));
  const hasValue = (fieldKey: string) => {
    const field = byFieldKey.get(fieldKey);
    return Boolean(field?.manualOverride || field?.value);
  };
  const needsVerified = (fieldKey: string) => {
    const field = byFieldKey.get(fieldKey);
    if (!field) return true;
    return ![DraftFieldStatus.VERIFIED, DraftFieldStatus.HIGH_CONFIDENCE, DraftFieldStatus.SUPPORTED].includes(field.status);
  };

  switch (reviewData.matter.visaSubclass) {
    case "485":
      if (!hasValue("study.qualification") && !hasValue("study.completion_date")) {
        hardBlockers.push(buildBlocker("HARD", "485_missing_completion", "Missing qualification or completion evidence", "Subclass 485 needs trusted qualification or completion evidence before the matter can move to agent final review.", "study.completion_date"));
      }
      if (!hasValue("english.test_type") && !hasValue("english.exemption_evidence")) {
        hardBlockers.push(buildBlocker("HARD", "485_missing_english", "Missing English evidence", "Subclass 485 requires English evidence or explicit exemption evidence.", "english.test_type"));
      }
      break;
    case "482":
      if (!hasValue("sponsor.business_name") || !hasValue("sponsor.nomination_details")) {
        hardBlockers.push(buildBlocker("HARD", "482_missing_sponsor_nomination", "Missing sponsor or nomination evidence", "Subclass 482 requires sponsor business and nomination evidence before agent final review.", "sponsor.business_name"));
      }
      if (!hasValue("employment.position_title") || !hasValue("employment.salary")) {
        hardBlockers.push(buildBlocker("HARD", "482_missing_employment_contract", "Missing occupation or salary evidence", "Subclass 482 requires source-backed role and salary evidence.", "employment.position_title"));
      }
      break;
    case "186":
      if (!hasValue("employment.employer_name") || !hasValue("sponsor.nomination_details")) {
        hardBlockers.push(buildBlocker("HARD", "186_missing_nomination", "Missing nomination or employer evidence", "Subclass 186 requires employer identity and nomination evidence.", "employment.employer_name"));
      }
      if (!hasValue("skills.assessment") && !hasValue("english.test_type") && !hasValue("english.exemption")) {
        hardBlockers.push(buildBlocker("HARD", "186_missing_skills_or_english", "Missing skills or English evidence", "Subclass 186 requires skills assessment or English evidence where relevant.", "skills.assessment"));
      }
      break;
    case "820/801":
    case "309/100":
      if (!hasValue("sponsor.full_name") || !hasValue("sponsor.status")) {
        hardBlockers.push(buildBlocker("HARD", "partner_missing_sponsor_identity", "Missing sponsor identity or status evidence", "Partner matters require trusted sponsor identity and status evidence.", "sponsor.full_name"));
      }
      if (!hasValue("relationship.start_date") || !hasValue("relationship.financial_evidence")) {
        hardBlockers.push(buildBlocker("HARD", "partner_missing_relationship_evidence", "Missing relationship evidence categories", "Relationship chronology and category evidence remain incomplete.", "relationship.start_date"));
      }
      break;
    case "189":
    case "190":
    case "491":
      if (!hasValue("skills.assessment_reference")) {
        hardBlockers.push(buildBlocker("HARD", "skilled_missing_assessment", "Missing skills assessment evidence", "Skilled migration matters require a trusted skills assessment reference.", "skills.assessment_reference"));
      }
      if (!hasValue("points.english") && !hasValue("english.test_type")) {
        hardBlockers.push(buildBlocker("HARD", "skilled_missing_english", "Missing English evidence", "Skilled migration matters require English evidence or an explicit evidenced exemption.", "english.test_type"));
      }
      if (reviewData.matter.visaSubclass === "190" && !hasValue("nomination.state")) {
        hardBlockers.push(buildBlocker("HARD", "skilled_missing_nomination", "Missing nomination evidence", "Subclass 190 matters require state or territory nomination evidence.", "nomination.state"));
      }
      if (reviewData.matter.visaSubclass === "491" && !hasValue("nomination.regional_support")) {
        hardBlockers.push(buildBlocker("HARD", "skilled_missing_nomination", "Missing nomination evidence", "Subclass 491 matters require regional nomination or sponsor evidence.", "nomination.regional_support"));
      }
      if (needsVerified("points.total")) {
        softBlockers.push(buildBlocker("SOFT", "skilled_points_unverified", "Skilled points remain unverified", "Points claims should stay review-required until the migration agent has checked the evidence behind them.", "points.total"));
      }
      break;
    case "600":
      if (!hasValue("travel.purpose") || !hasValue("travel.itinerary")) {
        hardBlockers.push(buildBlocker("HARD", "600_missing_travel_plan", "Missing travel purpose or itinerary", "Visitor matters require source-backed purpose-of-visit and itinerary evidence.", "travel.purpose"));
      }
      if (!hasValue("financial.available_funds")) {
        hardBlockers.push(buildBlocker("HARD", "600_missing_financials", "Missing financial evidence", "Visitor matters require funds or sponsor support evidence before agent final review.", "financial.available_funds"));
      }
      if (!hasValue("travel.home_ties_employment") && !hasValue("travel.home_ties_family") && !hasValue("travel.home_ties_property")) {
        softBlockers.push(buildBlocker("SOFT", "600_missing_home_ties", "Home ties evidence is still weak", "Visitor matters should include employment, family, property, or study ties supporting temporary stay intentions.", "travel.home_ties"));
      }
      break;
  }

  for (const issue of reviewData.openIssues ?? []) {
    const severity = issue.severity === IssueSeverity.HIGH || issue.severity === IssueSeverity.CRITICAL ? "HARD" : "SOFT";
    const alreadyRepresented = (severity === "HARD" ? hardBlockers : softBlockers).some((blocker) =>
      blocker.relatedFieldKey
      && issue.relatedFieldKey
      && blocker.relatedFieldKey === issue.relatedFieldKey
    );
    if (alreadyRepresented) continue;
    const bucket = severity === "HARD" ? hardBlockers : softBlockers;
    bucket.push(
      buildBlocker(
        severity,
        "validation_issue",
        issue.title,
        issue.description,
        issue.relatedFieldKey ?? undefined
      )
    );
  }

  const latestReviewRequest = reviewData.draft.reviewRequests?.[0] ?? null;
  if (!latestReviewRequest) {
    softBlockers.push(
      buildBlocker(
        "SOFT",
        "client_review_not_started",
        "Client review has not been started",
        "No client review request has been sent yet for this draft."
      )
    );
  }

  const latestConfirmationPayload = latestIntake?.questionnaireJson && typeof latestIntake.questionnaireJson === "string"
    ? decryptJson<Record<string, unknown>>(latestIntake.questionnaireJson)
    : null;
  const hasSubmittedClientConfirmations = Boolean(
    latestIntake?.submittedAt
    && latestConfirmationPayload
    && typeof latestConfirmationPayload === "object"
    && latestConfirmationPayload.clientConfirmations
  );

  if (clientConfirmationItems.length && !hasSubmittedClientConfirmations) {
    hardBlockers.push(
      buildBlocker(
        "HARD",
        "client_confirmation_missing",
        "Client confirmation is still required",
        "Aria has identified client-confirmed facts or declarations that still need a client response before the matter can move to agent final review."
      )
    );
  } else if (clientConfirmationItems.length && latestIntake?.submittedAt && latestIntake.status !== "REVIEWED") {
    softBlockers.push(
      buildBlocker(
        "SOFT",
        "client_confirmation_review_pending",
        "Client confirmation has been submitted and still needs agent review",
        "The client has responded, but the migration agent still needs to review the submitted confirmations before relying on them."
      )
    );
  }

  const reviewRequestState = {
    sent: Boolean(latestReviewRequest),
    confirmed: latestReviewRequest?.status === ReviewRequestStatus.SIGNED_CONFIRMED,
    latestStatus: latestReviewRequest?.status ?? null
  };

  const unique = (items: CaseSafetyBlocker[]) =>
    items.filter((item, index) =>
      items.findIndex((candidate) =>
        candidate.code === item.code
        && candidate.title === item.title
        && candidate.relatedFieldKey === item.relatedFieldKey
      ) === index
    );

  const finalHardBlockers = unique(hardBlockers);
  const finalSoftBlockers = unique(softBlockers);

  return {
    matterId: reviewData.matter.id,
    draftId: reviewData.draft.id,
    readinessScore: reviewData.draft.readinessScore,
    hardBlockers: finalHardBlockers,
    softBlockers: finalSoftBlockers,
    recommendedActions: [
      "Resolve all hard blockers before treating this matter as ready for agent final review.",
      "Keep client-facing use gated behind explicit migration agent review.",
      "Use client review requests for declarations and confirmations Aria cannot safely infer."
    ],
    readyForAgentFinalReview: finalHardBlockers.length === 0,
    reviewRequestState
  };
}
