import { PushStatus } from "@prisma/client";
import { getPushProviderEnv, type PushSendRequest } from "@/lib/providers/push-provider";
import { assertSafePushRoute, assertSafePushText, validatePushSubscriptionShape } from "@/lib/services/push/push-safety";

export function getWebPushDryRunPayload(input: PushSendRequest) {
  return {
    provider: "web_push" as const,
    title: assertSafePushText(input.title),
    body: assertSafePushText(input.body),
    route: assertSafePushRoute(input.route || null),
    tag: input.tag || "aria-notification",
    providerSpecificJson: {
      webpush: {
        notification: {
          title: assertSafePushText(input.title),
          body: assertSafePushText(input.body)
        }
      }
    }
  };
}

export async function sendWithWebPush(input: PushSendRequest) {
  const env = getPushProviderEnv();
  const payloadPreview = getWebPushDryRunPayload(input);
  if (!env.webPush.configured) {
    return {
      ok: false,
      provider: "web_push" as const,
      status: PushStatus.NOT_CONFIGURED,
      reason: "Web Push provider not configured.",
      payloadPreview
    };
  }

  if (input.dryRun !== false) {
    return {
      ok: false,
      provider: "web_push" as const,
      status: PushStatus.DRY_RUN,
      reason: "Web Push dry-run payload generated. No live push was sent.",
      payloadPreview
    };
  }

  return {
    ok: false,
    provider: "web_push" as const,
    status: PushStatus.FAILED,
    reason: "Web Push live delivery is not verified in this environment. Device registration and in-app fallback remain available.",
    payloadPreview
  };
}

export async function testWebPushConnection() {
  const env = getPushProviderEnv();
  return {
    ok: env.webPush.configured,
    reason: env.webPush.configured
      ? "Web Push environment is configured. This does not claim a live browser push was delivered."
      : "Web Push provider not configured.",
    providerName: "web_push"
  };
}

export function validateWebPushSubscription(input: { endpoint?: string | null; subscriptionJson?: string | null }) {
  if (!input.endpoint?.trim()) return { ok: false, reason: "Browser endpoint is missing." };
  if (!input.subscriptionJson?.trim()) return { ok: false, reason: "Subscription payload is missing." };
  if (!validatePushSubscriptionShape(input.subscriptionJson)) return { ok: false, reason: "Subscription payload is invalid." };
  return { ok: true as const };
}
