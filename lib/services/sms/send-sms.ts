import { auditEvent } from "@/lib/services/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { serverLog } from "@/lib/services/runtime-config";
import { getSmsProviderStatus, sendWithTwilio } from "@/lib/providers/sms-provider";

type SendSmsInput = {
  to: string;
  body: string;
  workspaceId?: string;
  userId?: string;
  rateLimitKey?: string;
};

function safeSmsBody(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 320);
}

export async function sendSms(input: SendSmsInput) {
  const status = getSmsProviderStatus();
  if (!status.configured) {
    return { delivered: false, reason: "SMS provider is not configured." };
  }

  const limit = checkRateLimit({
    key: input.rateLimitKey || `sms:${input.workspaceId || "system"}:${input.to.slice(-6)}`,
    limit: 5,
    windowMs: 10 * 60 * 1000
  });
  if (!limit.allowed) {
    return { delivered: false, reason: "SMS sending is temporarily rate limited." };
  }

  const body = safeSmsBody(input.body);
  try {
    await sendWithTwilio({ to: input.to, body });
    if (input.workspaceId && input.userId) {
      await auditEvent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        entityType: "Provider",
        entityId: "sms",
        action: "provider.sms.test_success",
        metadata: { bodyLength: body.length }
      });
    }
    return { delivered: true, reason: "SMS sent." };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    serverLog("sms.delivery_failed", { to: input.to, error: message });
    if (input.workspaceId && input.userId) {
      await auditEvent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        entityType: "Provider",
        entityId: "sms",
        action: "provider.sms.test_failed",
        metadata: { reason: message }
      });
    }
    return { delivered: false, reason: "SMS delivery failed." };
  }
}
