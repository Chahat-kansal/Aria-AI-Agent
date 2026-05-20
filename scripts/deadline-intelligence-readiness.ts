import { buildMatterDeadlineIntelligence, DEADLINE_REVIEW_DISCLAIMER } from "../lib/services/deadline-intelligence";

function addDays(base: Date, days: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function assertCondition(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const now = new Date("2026-05-21T10:00:00.000Z");

const result = buildMatterDeadlineIntelligence({
  id: "deadline-readiness-matter",
  title: "Deadline readiness dummy matter",
  visaSubclass: "500",
  currentVisaExpiry: addDays(now, 30),
  criticalDeadline: addDays(now, 2),
  lodgementTargetDate: addDays(now, 21),
  expectedNextMilestone: "Section 56 response due",
  checklistItems: [
    {
      id: "passport",
      label: "Passport bio page",
      required: true,
      dueDate: addDays(now, 7),
      documentId: null
    },
    {
      id: "coe",
      label: "Confirmation of Enrolment",
      required: true,
      dueDate: addDays(now, 9),
      documentId: "uploaded-doc"
    }
  ],
  documentRequests: [
    {
      id: "request-a",
      status: "SENT",
      dueDate: addDays(now, 3),
      reminderSentAt: null
    }
  ],
  intakeRequests: [
    {
      id: "confirmation-a",
      status: "SENT",
      title: "Health and character confirmation",
      expiresAt: addDays(now, 5)
    }
  ],
  appointments: [
    {
      id: "appointment-a",
      status: "REQUESTED",
      meetingType: "Evidence review",
      startsAt: addDays(now, 1)
    }
  ]
}, {
  now,
  emailConfigured: false
});

assertCondition(result.disclaimer === DEADLINE_REVIEW_DISCLAIMER, "Deadline disclaimer is missing or changed.");
assertCondition(result.status === "ACTION_REQUIRED", "Urgent deadlines should produce ACTION_REQUIRED status.");
assertCondition(result.alerts.some((item) => item.category === "CRITICAL_DEADLINE" && item.severity === "URGENT_48_HOURS"), "Critical deadline 48-hour alert missing.");
assertCondition(result.alerts.some((item) => item.category === "DOCUMENT_DUE" && item.title.includes("Passport")), "Missing document due alert missing.");
assertCondition(result.alerts.some((item) => item.category === "CLIENT_CONFIRMATION"), "Client confirmation due alert missing.");
assertCondition(result.alerts.some((item) => item.category === "APPOINTMENT"), "Appointment alert missing.");
assertCondition(result.reverseTimeline.length === 3, "Reverse timeline should include document, confirmation, and final-review planning dates.");
assertCondition(result.clientNudges.length >= 1, "Missing-document/request client nudge should be prepared.");
assertCondition(result.clientNudges.every((nudge) => nudge.channel === "manual" && nudge.sensitiveContentExcluded), "Fallback nudges must be manual and exclude sensitive content when email is not configured.");
assertCondition(result.agentAlerts.every((alert) => alert.message.includes("agent must verify legal deadline")), "Agent alerts must retain verification wording.");
assertCondition(!JSON.stringify(result).toLowerCase().includes("ready to lodge"), "Deadline intelligence must never use ready-to-lodge wording.");

console.log(JSON.stringify({
  pass: true,
  status: result.status,
  alerts: result.alerts.map((item) => ({ title: item.title, category: item.category, severity: item.severity, daysUntil: item.daysUntil })),
  reverseTimelineCount: result.reverseTimeline.length,
  clientNudgeCount: result.clientNudges.length,
  agentAlertCount: result.agentAlerts.length,
  disclaimer: result.disclaimer
}, null, 2));
