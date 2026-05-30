import { SmsConsentStatus, SmsStatus } from "@prisma/client";
import type { ProviderStatus, ProviderTestResult } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export type SmsProviderName = "clicksend" | "twilio" | "disabled";

export type SmsProviderEnv = {
  provider: SmsProviderName;
  configured: boolean;
  clicksend: {
    usernamePresent: boolean;
    apiKeyPresent: boolean;
    fromNamePresent: boolean;
    configured: boolean;
  };
  twilio: {
    accountSidPresent: boolean;
    authTokenPresent: boolean;
    messagingServiceSidPresent: boolean;
    fromNumberPresent: boolean;
    configured: boolean;
  };
  missingEnv: string[];
};

export type SmsDryRunPayload = {
  provider: SmsProviderName;
  to: string;
  body: string;
  from?: string | null;
};

export type SmsUsageSummary = {
  provider: SmsProviderName;
  configured: boolean;
  mode: "live" | "dry_run" | "disabled";
  messagesSentToday: number;
};

export type SmsSendRequest = {
  to: string;
  body: string;
  dryRun?: boolean;
};

export type SmsSendResult = {
  ok: boolean;
  provider: SmsProviderName;
  status: SmsStatus;
  providerMessageId?: string | null;
  reason: string;
  payloadPreview?: SmsDryRunPayload | null;
};

export type SmsRecipientValidation = {
  ok: boolean;
  normalized: string | null;
  reason?: string;
};

export type SmsConsentCheckResult = {
  allowed: boolean;
  consentStatus: SmsConsentStatus;
  reason: string;
};

export type SmsProviderAdapter = {
  getProviderStatus(): ProviderStatus;
  sendSms(input: SmsSendRequest): Promise<SmsSendResult>;
  sendTemplateSms(input: SmsSendRequest): Promise<SmsSendResult>;
  dryRunSmsPayload(input: SmsSendRequest): SmsDryRunPayload;
  validateRecipient(phone: string): SmsRecipientValidation;
  checkConsent(input: {
    workspaceId: string;
    clientId?: string | null;
    isAgentAlert?: boolean;
  }): Promise<SmsConsentCheckResult>;
  recordOptOut(input: {
    workspaceId: string;
    clientId: string;
    userId?: string | null;
    reason?: string | null;
  }): Promise<void>;
  testConnection(): Promise<ProviderTestResult>;
  getUsageSummary(workspaceId?: string): Promise<SmsUsageSummary>;
};

export function getSmsProviderName(): SmsProviderName {
  const value = (process.env.SMS_PROVIDER || "disabled").trim().toLowerCase();
  if (value === "clicksend") return "clicksend";
  if (value === "twilio") return "twilio";
  return "disabled";
}

export function getSmsProviderEnv(): SmsProviderEnv {
  const provider = getSmsProviderName();
  const clicksend = {
    usernamePresent: hasConfiguredValue(process.env.CLICKSEND_USERNAME),
    apiKeyPresent: hasConfiguredSecret(process.env.CLICKSEND_API_KEY),
    fromNamePresent: hasConfiguredValue(process.env.CLICKSEND_FROM_NAME),
    configured: false
  };
  clicksend.configured = clicksend.usernamePresent && clicksend.apiKeyPresent;

  const twilio = {
    accountSidPresent: hasConfiguredValue(process.env.TWILIO_ACCOUNT_SID),
    authTokenPresent: hasConfiguredSecret(process.env.TWILIO_AUTH_TOKEN),
    messagingServiceSidPresent: hasConfiguredValue(process.env.TWILIO_MESSAGING_SERVICE_SID),
    fromNumberPresent: hasConfiguredValue(process.env.TWILIO_FROM_NUMBER),
    configured: false
  };
  twilio.configured = twilio.accountSidPresent && twilio.authTokenPresent && (twilio.messagingServiceSidPresent || twilio.fromNumberPresent);

  const configured = provider === "clicksend" ? clicksend.configured : provider === "twilio" ? twilio.configured : false;

  let missingEnv: string[] = [];
  if (provider === "clicksend") {
    missingEnv = [
      !clicksend.usernamePresent ? "CLICKSEND_USERNAME" : null,
      !clicksend.apiKeyPresent ? "CLICKSEND_API_KEY" : null,
      !clicksend.fromNamePresent ? "CLICKSEND_FROM_NAME" : null
    ].filter(Boolean) as string[];
  } else if (provider === "twilio") {
    missingEnv = [
      !twilio.accountSidPresent ? "TWILIO_ACCOUNT_SID" : null,
      !twilio.authTokenPresent ? "TWILIO_AUTH_TOKEN" : null,
      !(twilio.messagingServiceSidPresent || twilio.fromNumberPresent) ? "TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER" : null
    ].filter(Boolean) as string[];
  }

  return { provider, configured, clicksend, twilio, missingEnv };
}

export function getSmsProviderStatus(): ProviderStatus {
  const env = getSmsProviderEnv();
  if (env.provider === "disabled") {
    return buildProviderStatus({
      key: "sms",
      label: "SMS",
      providerName: "disabled",
      configured: false,
      state: "disabled",
      missingEnv: ["SMS_PROVIDER"],
      requiredSetupSteps: [
        "Choose SMS_PROVIDER=clicksend or SMS_PROVIDER=twilio.",
        "Confirm workspace consent rules before enabling client SMS reminders."
      ],
      notes: [
        "ClickSend is recommended for Australian SMS reminders. Twilio is available for global/advanced messaging setups.",
        "SMS messages use generic wording and do not include sensitive visa, identity, health, character, or document details."
      ],
      disabledReason: "SMS provider not configured."
    });
  }

  const providerName = env.provider === "clicksend" ? "clicksend" : "twilio";
  const requiredSetupSteps = env.provider === "clicksend"
    ? [
        "Set SMS_PROVIDER=clicksend.",
        "Add ClickSend username, API key, and optional from name.",
        "Confirm workspace SMS consent and opt-out policy before live sends."
      ]
    : [
        "Set SMS_PROVIDER=twilio.",
        "Add Twilio account SID, auth token, and messaging service SID or from number.",
        "Confirm workspace SMS consent and opt-out policy before live sends."
      ];

  const selectedStateMessage = env.provider === "clicksend"
    ? "ClickSend is selected but not configured."
    : "Twilio is selected but not configured.";

  return buildProviderStatus({
    key: "sms",
    label: "SMS",
    providerName,
    configured: env.configured,
    state: env.configured ? "configured" : "not_configured",
    missingEnv: env.missingEnv,
    requiredSetupSteps: env.configured ? [] : requiredSetupSteps,
    notes: [
      "ClickSend is recommended for Australian SMS reminders. Twilio is available for global/advanced messaging setups.",
      "SMS content must stay generic and use secure portal login rather than raw document links or tokenized URLs.",
      env.configured ? "Consent checks and rate limiting apply before live client SMS sends." : selectedStateMessage
    ]
  });
}
