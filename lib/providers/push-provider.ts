import type { ProviderStatus } from "@/lib/providers/types";
import { buildProviderStatus, hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getPushProviderStatus(): ProviderStatus {
  const provider = (process.env.PUSH_PROVIDER || "disabled").trim().toLowerCase();
  const webPushConfigured =
    hasConfiguredValue(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
    hasConfiguredSecret(process.env.VAPID_PRIVATE_KEY);
  const firebaseConfigured =
    hasConfiguredValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
    hasConfiguredValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
    hasConfiguredValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) &&
    hasConfiguredValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) &&
    hasConfiguredSecret(process.env.FIREBASE_SERVER_KEY);
  const configured = (provider === "web_push" && webPushConfigured) || (provider === "firebase" && firebaseConfigured);

  return buildProviderStatus({
    key: "push",
    label: "Push notifications",
    providerName: provider,
    configured,
    state: provider === "disabled" ? "disabled" : configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : provider === "web_push"
        ? ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]
        : provider === "firebase"
          ? [
              "NEXT_PUBLIC_FIREBASE_API_KEY",
              "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
              "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
              "NEXT_PUBLIC_FIREBASE_APP_ID",
              "FIREBASE_SERVER_KEY"
            ]
          : ["PUSH_PROVIDER"],
    requiredSetupSteps: configured ? [] : ["Choose PUSH_PROVIDER.", "Enable only generic notification text and explicit user opt-in."],
    notes: [
      "Push notifications must stay generic and avoid sensitive client facts.",
      "No native app availability is claimed here; this supports web/PWA push only when configured."
    ],
    disabledReason: provider === "disabled" ? "Push notifications are disabled until a provider is configured." : null
  });
}
