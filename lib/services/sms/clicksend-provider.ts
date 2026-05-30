import { SmsStatus } from "@prisma/client";
import { getSmsProviderEnv, type SmsDryRunPayload, type SmsSendRequest, type SmsSendResult } from "@/lib/providers/sms-provider";
import { redactSmsErrorSummary } from "@/lib/services/sms/sms-redaction";

function buildClickSendPayload(input: SmsSendRequest): SmsDryRunPayload {
  return {
    provider: "clicksend",
    to: input.to,
    body: input.body,
    from: process.env.CLICKSEND_FROM_NAME?.trim() || null
  };
}

export async function sendWithClickSend(input: SmsSendRequest): Promise<SmsSendResult> {
  const env = getSmsProviderEnv();
  const payload = buildClickSendPayload(input);
  if (!env.clicksend.configured) {
    return {
      ok: false,
      provider: "clicksend",
      status: SmsStatus.NOT_CONFIGURED,
      reason: "ClickSend is selected but not configured.",
      payloadPreview: payload
    };
  }

  if (input.dryRun) {
    return { ok: true, provider: "clicksend", status: SmsStatus.DRY_RUN, reason: "dry_run", payloadPreview: payload };
  }

  const response = await fetch("https://rest.clicksend.com/v3/sms/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.CLICKSEND_USERNAME}:${process.env.CLICKSEND_API_KEY}`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [
        {
          source: "sdk",
          from: process.env.CLICKSEND_FROM_NAME?.trim() || undefined,
          body: input.body,
          to: input.to
        }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    return {
      ok: false,
      provider: "clicksend",
      status: SmsStatus.FAILED,
      reason: redactSmsErrorSummary(`ClickSend delivery failed (${response.status}): ${errorBody}`) || "ClickSend delivery failed.",
      payloadPreview: payload
    };
  }

  const json = await response.json().catch(() => ({} as any));
  const messageId = json?.data?.messages?.[0]?.message_id ?? null;
  return {
    ok: true,
    provider: "clicksend",
    status: SmsStatus.SENT,
    providerMessageId: messageId,
    reason: "sent",
    payloadPreview: payload
  };
}

export async function testClickSendConnection() {
  const env = getSmsProviderEnv();
  return {
    ok: env.clicksend.configured,
    reason: env.clicksend.configured ? "ClickSend credentials are present for live-safe testing." : "ClickSend is not configured.",
    providerName: "clicksend"
  };
}

export function getClickSendDryRunPayload(input: SmsSendRequest) {
  return buildClickSendPayload(input);
}
