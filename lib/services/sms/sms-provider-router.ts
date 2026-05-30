import { SmsConsentStatus, SmsStatus } from "@prisma/client";
import {
  getSmsProviderEnv,
  getSmsProviderName,
  getSmsProviderStatus,
  type SmsProviderAdapter,
  type SmsSendRequest
} from "@/lib/providers/sms-provider";
import { prisma } from "@/lib/prisma";
import { checkSmsConsent, recordSmsOptOut } from "@/lib/services/sms/sms-consent";
import { sendWithClickSend, testClickSendConnection, getClickSendDryRunPayload } from "@/lib/services/sms/clicksend-provider";
import { sendWithTwilio, testTwilioConnection, getTwilioDryRunPayload } from "@/lib/services/sms/twilio-provider";
import { validateSmsRecipient } from "@/lib/services/sms/sms-safety";

const disabledRouter: SmsProviderAdapter = {
  getProviderStatus: getSmsProviderStatus,
  async sendSms(input) {
    return {
      ok: false,
      provider: "disabled",
      status: SmsStatus.NOT_CONFIGURED,
      reason: "SMS provider not configured.",
      payloadPreview: { provider: "disabled", to: input.to, body: input.body, from: null }
    };
  },
  sendTemplateSms(input) {
    return this.sendSms(input);
  },
  dryRunSmsPayload(input) {
    return { provider: "disabled", to: input.to, body: input.body, from: null };
  },
  validateRecipient: validateSmsRecipient,
  async checkConsent(input) {
    return checkSmsConsent(input);
  },
  async recordOptOut(input) {
    await recordSmsOptOut(input);
  },
  async testConnection() {
    return { ok: false, reason: "SMS provider not configured.", providerName: "disabled" };
  },
  async getUsageSummary() {
    return { provider: "disabled", configured: false, mode: "disabled", messagesSentToday: 0 };
  }
};

const clicksendRouter: SmsProviderAdapter = {
  getProviderStatus: getSmsProviderStatus,
  sendSms: sendWithClickSend,
  sendTemplateSms: sendWithClickSend,
  dryRunSmsPayload: getClickSendDryRunPayload,
  validateRecipient: validateSmsRecipient,
  async checkConsent(input) {
    return checkSmsConsent(input);
  },
  async recordOptOut(input) {
    await recordSmsOptOut(input);
  },
  testConnection: testClickSendConnection,
  async getUsageSummary(workspaceId) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const count = workspaceId
      ? await prisma.smsMessage.count({ where: { workspaceId, provider: "clicksend", status: SmsStatus.SENT, sentAt: { gte: since } } })
      : 0;
    return { provider: "clicksend", configured: getSmsProviderEnv().clicksend.configured, mode: getSmsProviderEnv().clicksend.configured ? "live" : "dry_run", messagesSentToday: count };
  }
};

const twilioRouter: SmsProviderAdapter = {
  getProviderStatus: getSmsProviderStatus,
  sendSms: sendWithTwilio,
  sendTemplateSms: sendWithTwilio,
  dryRunSmsPayload: getTwilioDryRunPayload,
  validateRecipient: validateSmsRecipient,
  async checkConsent(input) {
    return checkSmsConsent(input);
  },
  async recordOptOut(input) {
    await recordSmsOptOut(input);
  },
  testConnection: testTwilioConnection,
  async getUsageSummary(workspaceId) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const count = workspaceId
      ? await prisma.smsMessage.count({ where: { workspaceId, provider: "twilio", status: SmsStatus.SENT, sentAt: { gte: since } } })
      : 0;
    return { provider: "twilio", configured: getSmsProviderEnv().twilio.configured, mode: getSmsProviderEnv().twilio.configured ? "live" : "dry_run", messagesSentToday: count };
  }
};

export function getSmsProviderRouter(): SmsProviderAdapter {
  const provider = getSmsProviderName();
  if (provider === "clicksend") return clicksendRouter;
  if (provider === "twilio") return twilioRouter;
  return disabledRouter;
}

export async function buildSmsConsentSnapshot(workspaceId: string, clientId?: string | null, isAgentAlert?: boolean) {
  const result = await getSmsProviderRouter().checkConsent({ workspaceId, clientId, isAgentAlert });
  return {
    ...result,
    statusLabel:
      result.consentStatus === SmsConsentStatus.CONSENTED ? "Consented"
      : result.consentStatus === SmsConsentStatus.OPTED_OUT ? "Opted out"
      : result.consentStatus === SmsConsentStatus.INTERNAL_ONLY ? "Internal only"
      : "SMS consent not recorded"
  };
}
