export type ProviderConfiguredState = "configured" | "not_configured" | "disabled";

export type ProviderStatus = {
  key:
    | "email"
    | "sms"
    | "ocr"
    | "ai"
    | "storage"
    | "payments"
    | "esign"
    | "monitoring"
    | "analytics";
  label: string;
  providerName: string;
  configured: boolean;
  state: ProviderConfiguredState;
  missingEnv: string[];
  notes: string[];
  lastSuccessfulTestAt?: string | null;
  lastErrorSummary?: string | null;
};

export type ProviderTestResult = {
  ok: boolean;
  reason: string;
  providerName: string;
};
