export type ProviderConfiguredState = "configured" | "not_configured" | "disabled";
export type ProviderConnectionState = "connected" | "disconnected" | "attention_required";
export type ProviderKey =
  | "email"
  | "sms"
  | "ocr"
  | "ai"
  | "storage"
  | "payments"
  | "esign"
  | "monitoring"
  | "analytics"
  | "accounting"
  | "calendar"
  | "email_sync"
  | "cloud_drive"
  | "push"
  | "mobile"
  | "offline_sync";

export type ProviderStatus = {
  key: ProviderKey;
  label: string;
  providerName: string;
  configured: boolean;
  state: ProviderConfiguredState;
  connected: boolean;
  connectionState: ProviderConnectionState;
  missingEnv: string[];
  requiredSetupSteps: string[];
  notes: string[];
  disabledReason?: string | null;
  connectedAccountLabel?: string | null;
  lastSuccessfulTestAt?: string | null;
  lastSuccessfulActionAt?: string | null;
  lastSyncAt?: string | null;
  lastErrorSummary?: string | null;
};

export type ProviderTestResult = {
  ok: boolean;
  reason: string;
  providerName: string;
};
