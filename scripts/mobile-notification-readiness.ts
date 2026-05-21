import { buildMobilePortalGuidance, buildNotificationSafetyView, mobileExperienceChecklist } from "../lib/services/mobile-notification-safety";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const channels = buildNotificationSafetyView({ emailConfigured: true, smsConfigured: false, pushConfigured: false });

assert(channels.length === 4, "Expected in-app, email, SMS, and push channel views.");
assert(channels.find((channel) => channel.channel === "email")?.status === "configured", "Email should show configured when available.");
assert(channels.find((channel) => channel.channel === "sms")?.status === "placeholder", "SMS should remain placeholder when not configured.");
assert(channels.every((channel) => channel.sensitiveContentAllowed === false), "Notification payloads must not allow sensitive content.");
assert(channels.every((channel) => !/passport|dob|document contents|token hash/i.test(channel.messageRule) || /Do not|never/i.test(channel.messageRule)), "Sensitive notification guidance should be restrictive.");
assert(mobileExperienceChecklist.length >= 5, "Mobile experience checklist should cover portal, uploads, confirmations, appointments, and manual QA.");
assert(buildMobilePortalGuidance(2).includes("2 requested documents"), "Mobile portal guidance should surface missing document count.");
assert(!/ready to lodge|guarantee|legal advice/i.test(`${channels.map((channel) => channel.messageRule).join(" ")} ${mobileExperienceChecklist.join(" ")}`), "Mobile notification wording must stay safety-first.");

console.log("Mobile web and notification readiness passed.");
console.log(JSON.stringify({ channels: channels.map((channel) => ({ channel: channel.channel, status: channel.status })) }, null, 2));
