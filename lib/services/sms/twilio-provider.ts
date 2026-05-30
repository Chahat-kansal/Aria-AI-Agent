import { SmsStatus } from "@prisma/client";
import { getSmsProviderEnv, type SmsDryRunPayload, type SmsSendRequest, type SmsSendResult } from "@/lib/providers/sms-provider";
import { redactSmsErrorSummary } from "@/lib/services/sms/sms-redaction";

function buildTwilioPayload(input: SmsSendRequest): SmsDryRunPayload {
  return {
    provider: "twilio",
    to: input.to,
    body: input.body,
    from: process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_FROM_NUMBER?.trim() || null
  };
}

export async function sendWithTwilio(input: SmsSendRequest): Promise<SmsSendResult> {
  const env = getSmsProviderEnv();
  const payload = buildTwilioPayload(input);
  if (!env.twilio.configured) {
    return {
      ok: false,
      provider: "twilio",
      status: SmsStatus.NOT_CONFIGURED,
      reason: "Twilio is selected but not configured.",
      payloadPreview: payload
    };
  }

  if (input.dryRun) {
    return { ok: true, provider: "twilio", status: SmsStatus.DRY_RUN, reason: "dry_run", payloadPreview: payload };
  }

  const params = new URLSearchParams({ To: input.to, Body: input.body });
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else params.set("From", String(process.env.TWILIO_FROM_NUMBER || ""));

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    return {
      ok: false,
      provider: "twilio",
      status: SmsStatus.FAILED,
      reason: redactSmsErrorSummary(`Twilio delivery failed (${response.status}): ${errorBody}`) || "Twilio delivery failed.",
      payloadPreview: payload
    };
  }

  const json = await response.json().catch(() => ({} as any));
  return {
    ok: true,
    provider: "twilio",
    status: SmsStatus.SENT,
    providerMessageId: json?.sid ?? null,
    reason: "sent",
    payloadPreview: payload
  };
}

export async function testTwilioConnection() {
  const env = getSmsProviderEnv();
  return {
    ok: env.twilio.configured,
    reason: env.twilio.configured ? "Twilio credentials are present for live-safe testing." : "Twilio is not configured.",
    providerName: "twilio"
  };
}

export function getTwilioDryRunPayload(input: SmsSendRequest) {
  return buildTwilioPayload(input);
}
