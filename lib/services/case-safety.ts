import { DraftFieldStatus, IssueSeverity, ReviewRequestStatus } from "@prisma/client";
import { getDraftReviewData } from "@/lib/services/application-draft";

const UNSAFE_FIELD_KEYS = new Set([
  "statement.genuine_student",
  "health.declarations",
  "character.declarations",
  "signature.client_signature"
]);

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

    if (UNSAFE_FIELD_KEYS.has(fieldKey) && field.status !== DraftFieldStatus.VERIFIED) {
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
