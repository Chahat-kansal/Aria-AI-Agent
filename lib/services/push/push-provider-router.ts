import {
  getPushProviderEnv,
  getPushProviderName,
  getPushProviderStatus,
  type PushProviderAdapter
} from "@/lib/providers/push-provider";
import { checkPushConsent, recordPushOptOut } from "@/lib/services/push/push-consent";
import {
  getPushUsageSummary,
  registerPushDevice,
  unregisterPushDevice
} from "@/lib/services/push/device-subscriptions";
import { getWebPushDryRunPayload, sendWithWebPush, testWebPushConnection, validateWebPushSubscription } from "@/lib/services/push/web-push-provider";
import { getFcmDryRunPayload, sendWithFcm, testFcmConnection, validateFcmSubscription } from "@/lib/services/push/fcm-provider";

const disabledRouter: PushProviderAdapter = {
  getProviderStatus: getPushProviderStatus,
  async registerDevice() {
    return { ok: false, reason: "Push provider not configured." };
  },
  async unregisterDevice() {
    return { ok: false, reason: "Push provider not configured." };
  },
  async sendPush(input) {
    return {
      ok: false,
      provider: "disabled",
      status: "NOT_CONFIGURED",
      reason: "Push provider not configured.",
      payloadPreview: { provider: "disabled", title: input.title, body: input.body, route: input.route || null, tag: input.tag || null }
    };
  },
  sendTemplatePush(input) {
    return this.sendPush(input);
  },
  dryRunPushPayload(input) {
    return { provider: "disabled", title: input.title, body: input.body, route: input.route || null, tag: input.tag || null };
  },
  validateSubscription() {
    return { ok: false, reason: "Push provider not configured." };
  },
  checkConsent(input) {
    return checkPushConsent(input);
  },
  async recordOptOut(input) {
    await recordPushOptOut(input);
  },
  async testConnection() {
    return { ok: false, reason: "Push provider not configured.", providerName: "disabled" };
  },
  async getUsageSummary() {
    return { provider: "disabled", configured: false, mode: "disabled", sendsToday: 0, registeredDevices: 0 };
  }
};

const webPushRouter: PushProviderAdapter = {
  getProviderStatus: getPushProviderStatus,
  async registerDevice(input) {
    await registerPushDevice({ ...input, provider: "web_push" });
    return { ok: true, reason: "Web Push device registered." };
  },
  unregisterDevice: unregisterPushDevice,
  sendPush: sendWithWebPush,
  sendTemplatePush: sendWithWebPush,
  dryRunPushPayload: getWebPushDryRunPayload,
  validateSubscription: validateWebPushSubscription,
  checkConsent: checkPushConsent,
  async recordOptOut(input) {
    await recordPushOptOut(input);
  },
  testConnection: testWebPushConnection,
  async getUsageSummary(workspaceId) {
    const usage = await getPushUsageSummary(workspaceId);
    return {
      provider: "web_push",
      configured: getPushProviderEnv().webPush.configured,
      mode: getPushProviderEnv().webPush.configured ? "live" : "dry_run",
      sendsToday: usage.sendsToday,
      registeredDevices: usage.registeredDevices
    };
  }
};

const fcmRouter: PushProviderAdapter = {
  getProviderStatus: getPushProviderStatus,
  async registerDevice(input) {
    await registerPushDevice({ ...input, provider: "fcm" });
    return { ok: true, reason: "FCM device registered." };
  },
  unregisterDevice: unregisterPushDevice,
  sendPush: sendWithFcm,
  sendTemplatePush: sendWithFcm,
  dryRunPushPayload: getFcmDryRunPayload,
  validateSubscription: validateFcmSubscription,
  checkConsent: checkPushConsent,
  async recordOptOut(input) {
    await recordPushOptOut(input);
  },
  testConnection: testFcmConnection,
  async getUsageSummary(workspaceId) {
    const usage = await getPushUsageSummary(workspaceId);
    return {
      provider: "fcm",
      configured: getPushProviderEnv().fcm.configured,
      mode: getPushProviderEnv().fcm.configured ? "live" : "dry_run",
      sendsToday: usage.sendsToday,
      registeredDevices: usage.registeredDevices
    };
  }
};

export function getPushProviderRouter(): PushProviderAdapter {
  const provider = getPushProviderName();
  if (provider === "web_push") return webPushRouter;
  if (provider === "fcm") return fcmRouter;
  return disabledRouter;
}
