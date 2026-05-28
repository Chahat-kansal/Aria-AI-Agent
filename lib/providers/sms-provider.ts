import type { ProviderStatus, ProviderTestResult } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getSmsProviderStatus(): ProviderStatus {
  const configured =
    hasConfiguredValue(process.env.TWILIO_ACCOUNT_SID) &&
    hasConfiguredSecret(process.env.TWILIO_AUTH_TOKEN) &&
    (hasConfiguredValue(process.env.TWILIO_MESSAGING_SERVICE_SID) || hasConfiguredValue(process.env.TWILIO_FROM_NUMBER));

  return buildProviderStatus({
    key: "sms",
    label: "SMS",
    providerName: configured ? "twilio" : "not configured",
    configured,
    state: configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER"],
    notes: [
      "SMS content must stay generic and never include sensitive client facts.",
      "Use for reminders and alerts only when contact consent exists."
    ],
    requiredSetupSteps: configured ? [] : ["Configure Twilio credentials.", "Confirm consent rules before sending client SMS reminders."]
  });
}

export async function sendWithTwilio(input: { to: string; body: string }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const params = new URLSearchParams({ To: input.to, Body: input.body });
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else params.set("From", String(process.env.TWILIO_FROM_NUMBER || ""));

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Twilio delivery failed (${response.status}): ${body.slice(0, 160)}`);
  }

  return response.json().catch(() => ({}));
}

export async function sendSmsProviderTest(to: string): Promise<ProviderTestResult> {
  const status = getSmsProviderStatus();
  if (!status.configured) {
    return { ok: false, reason: "SMS provider is not configured.", providerName: status.providerName };
  }

  await sendWithTwilio({
    to,
    body: "Aria test SMS: secure reminder flow is configured. Ready for agent final review."
  });

  return { ok: true, reason: "Test SMS sent.", providerName: status.providerName };
}
