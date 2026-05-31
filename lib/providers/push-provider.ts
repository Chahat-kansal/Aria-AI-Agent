import type { ProviderStatus, ProviderTestResult } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export type PushConsentStatus = "UNKNOWN" | "OPTED_IN" | "OPTED_OUT" | "INTERNAL_ONLY";
export type PushStatus = "DRAFT" | "DRY_RUN" | "SENT" | "FAILED" | "BLOCKED_NO_CONSENT" | "BLOCKED_RATE_LIMITED" | "NOT_CONFIGURED" | "OPTED_OUT" | "IN_APP_ONLY";

export type PushProviderName = "web_push" | "fcm" | "disabled";

export type PushProviderEnv = {
  provider: PushProviderName;
  configured: boolean;
  webPush: {
    publicKeyPresent: boolean;
    privateKeyPresent: boolean;
    contactEmailPresent: boolean;
    configured: boolean;
  };
  fcm: {
    projectIdPresent: boolean;
    clientEmailPresent: boolean;
    privateKeyPresent: boolean;
    configured: boolean;
  };
  missingEnv: string[];
};

export type PushPayloadPreview = {
  provider: PushProviderName;
  title: string;
  body: string;
  route: string | null;
  tag?: string | null;
  providerSpecificJson?: Record<string, unknown> | null;
};

export type PushSendRequest = {
  title: string;
  body: string;
  route?: string | null;
  dryRun?: boolean;
  tag?: string | null;
};

export type PushSendResult = {
  ok: boolean;
  provider: PushProviderName;
  status: PushStatus;
  reason: string;
  payloadPreview?: PushPayloadPreview | null;
  providerMessageId?: string | null;
};

export type PushUsageSummary = {
  provider: PushProviderName;
  configured: boolean;
  mode: "live" | "dry_run" | "disabled";
  sendsToday: number;
  registeredDevices: number;
};

export type PushConsentCheckResult = {
  allowed: boolean;
  consentStatus: PushConsentStatus;
  reason: string;
};

export type PushProviderAdapter = {
  getProviderStatus(): ProviderStatus;
  registerDevice(input: {
    workspaceId: string;
    userId: string;
    clientId?: string | null;
    deviceId: string;
    endpoint: string;
    subscriptionJson: string;
    platform?: string | null;
    userAgent?: string | null;
  }): Promise<{ ok: boolean; reason: string }>;
  unregisterDevice(input: { workspaceId: string; userId: string; deviceId: string }): Promise<{ ok: boolean; reason: string }>;
  sendPush(input: PushSendRequest & { workspaceId: string; userId?: string | null; deviceIds?: string[] }): Promise<PushSendResult>;
  sendTemplatePush(input: PushSendRequest & { workspaceId: string; userId?: string | null; deviceIds?: string[] }): Promise<PushSendResult>;
  dryRunPushPayload(input: PushSendRequest): PushPayloadPreview;
  validateSubscription(input: { endpoint?: string | null; subscriptionJson?: string | null }): { ok: boolean; reason?: string };
  checkConsent(input: { workspaceId: string; userId: string; clientId?: string | null; isAgentAlert?: boolean }): Promise<PushConsentCheckResult>;
  recordOptOut(input: { workspaceId: string; userId: string; clientId?: string | null; reason?: string | null }): Promise<void>;
  testConnection(): Promise<ProviderTestResult>;
  getUsageSummary(workspaceId?: string): Promise<PushUsageSummary>;
};

export function getPushProviderName(): PushProviderName {
  const value = (process.env.PUSH_PROVIDER || "disabled").trim().toLowerCase();
  if (value === "web_push") return "web_push";
  if (value === "fcm") return "fcm";
  return "disabled";
}

export function getPushProviderEnv(): PushProviderEnv {
  const provider = getPushProviderName();
  const webPush = {
    publicKeyPresent: hasConfiguredValue(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY),
    privateKeyPresent: hasConfiguredSecret(process.env.WEB_PUSH_VAPID_PRIVATE_KEY),
    contactEmailPresent: hasConfiguredValue(process.env.WEB_PUSH_CONTACT_EMAIL),
    configured: false
  };
  webPush.configured = webPush.publicKeyPresent && webPush.privateKeyPresent && webPush.contactEmailPresent;

  const fcm = {
    projectIdPresent: hasConfiguredValue(process.env.FCM_PROJECT_ID),
    clientEmailPresent: hasConfiguredValue(process.env.FCM_CLIENT_EMAIL),
    privateKeyPresent: hasConfiguredSecret(process.env.FCM_PRIVATE_KEY),
    configured: false
  };
  fcm.configured = fcm.projectIdPresent && fcm.clientEmailPresent && fcm.privateKeyPresent;

  const configured = provider === "web_push" ? webPush.configured : provider === "fcm" ? fcm.configured : false;
  let missingEnv: string[] = [];
  if (provider === "web_push") {
    missingEnv = [
      !webPush.publicKeyPresent ? "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY" : null,
      !webPush.privateKeyPresent ? "WEB_PUSH_VAPID_PRIVATE_KEY" : null,
      !webPush.contactEmailPresent ? "WEB_PUSH_CONTACT_EMAIL" : null
    ].filter(Boolean) as string[];
  } else if (provider === "fcm") {
    missingEnv = [
      !fcm.projectIdPresent ? "FCM_PROJECT_ID" : null,
      !fcm.clientEmailPresent ? "FCM_CLIENT_EMAIL" : null,
      !fcm.privateKeyPresent ? "FCM_PRIVATE_KEY" : null
    ].filter(Boolean) as string[];
  }

  return { provider, configured, webPush, fcm, missingEnv };
}

export function getPushProviderStatus(): ProviderStatus {
  const env = getPushProviderEnv();

  if (env.provider === "disabled") {
    return buildProviderStatus({
      key: "push",
      label: "Push notifications",
      providerName: "disabled",
      configured: false,
      state: "disabled",
      missingEnv: ["PUSH_PROVIDER"],
      requiredSetupSteps: [
        "Choose PUSH_PROVIDER=web_push or PUSH_PROVIDER=fcm.",
        "Enable only generic notification text and explicit opt-in.",
        "Keep in-app notification fallback available when push is disabled."
      ],
      notes: [
        "Push notifications must stay generic and avoid sensitive client facts.",
        "No native app availability is claimed here; this supports web/PWA push only when configured."
      ],
      disabledReason: "Push notifications are disabled until a provider is configured."
    });
  }

  const selectedMessage =
    env.provider === "web_push"
      ? "Web Push is selected but not configured."
      : "FCM is selected but not configured.";

  return buildProviderStatus({
    key: "push",
    label: "Push notifications",
    providerName: env.provider,
    configured: env.configured,
    state: env.configured ? "configured" : "not_configured",
    missingEnv: env.missingEnv,
    requiredSetupSteps: env.configured
      ? []
      : env.provider === "web_push"
        ? [
            "Set PUSH_PROVIDER=web_push.",
            "Add VAPID public/private keys and contact email.",
            "Register the service worker and capture explicit user opt-in before testing push sends."
          ]
        : [
            "Set PUSH_PROVIDER=fcm.",
            "Add Firebase project, client email, and private key.",
            "Keep notification payloads generic and route users back into Aria for details."
          ],
    notes: [
      "Push notifications use generic wording and do not include sensitive visa, identity, health, character, financial, or document details.",
      "In-app notifications remain the safe fallback when push is disabled or not configured.",
      env.configured ? "Push sends are still opt-in, rate-limited, and privacy-scoped." : selectedMessage
    ]
  });
}
