import { PushStatus } from "@prisma/client";
import { getPushProviderEnv, type PushSendRequest } from "@/lib/providers/push-provider";
import { assertSafePushRoute, assertSafePushText, validatePushSubscriptionShape } from "@/lib/services/push/push-safety";

export function getFcmDryRunPayload(input: PushSendRequest) {
  return {
    provider: "fcm" as const,
    title: assertSafePushText(input.title),
    body: assertSafePushText(input.body),
    route: assertSafePushRoute(input.route || null),
    tag: input.tag || "aria-notification",
    providerSpecificJson: {
      notification: {
        title: assertSafePushText(input.title),
        body: assertSafePushText(input.body)
      },
      webpush: {
        fcmOptions: {
          link: assertSafePushRoute(input.route || null)
        }
      }
    }
  };
}

export async function sendWithFcm(input: PushSendRequest) {
  const env = getPushProviderEnv();
  const payloadPreview = getFcmDryRunPayload(input);
  if (!env.fcm.configured) {
    return {
      ok: false,
      provider: "fcm" as const,
      status: PushStatus.NOT_CONFIGURED,
      reason: "FCM provider not configured.",
      payloadPreview
    };
  }

  if (input.dryRun !== false) {
    return {
      ok: false,
      provider: "fcm" as const,
      status: PushStatus.DRY_RUN,
      reason: "FCM dry-run payload generated. No live push was sent.",
      payloadPreview
    };
  }

  return {
    ok: false,
    provider: "fcm" as const,
    status: PushStatus.FAILED,
    reason: "FCM live delivery is not verified in this environment. In-app notifications remain available.",
    payloadPreview
  };
}

export async function testFcmConnection() {
  const env = getPushProviderEnv();
  return {
    ok: env.fcm.configured,
    reason: env.fcm.configured
      ? "FCM environment is configured. This does not claim a live device push was delivered."
      : "FCM provider not configured.",
    providerName: "fcm"
  };
}

export function validateFcmSubscription(input: { endpoint?: string | null; subscriptionJson?: string | null }) {
  if (!input.endpoint?.trim()) return { ok: false, reason: "Device endpoint is missing." };
  if (!input.subscriptionJson?.trim()) return { ok: false, reason: "Subscription payload is missing." };
  if (!validatePushSubscriptionShape(input.subscriptionJson)) return { ok: false, reason: "Subscription payload is invalid." };
  return { ok: true as const };
}
