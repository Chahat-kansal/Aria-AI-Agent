import type { ProviderStatus } from "@/lib/providers/types";
import { hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getOcrProviderStatus(): ProviderStatus {
  const provider = (process.env.OCR_PROVIDER || "").trim().toLowerCase();
  const legacyProvider = (process.env.DOCUMENT_AI_PROVIDER || "").trim().toLowerCase();

  if (!provider && !legacyProvider) {
    return {
      key: "ocr",
      label: "OCR / Vision",
      providerName: "not configured",
      configured: false,
      state: "not_configured",
      missingEnv: ["OCR_PROVIDER plus matching provider credentials"],
      notes: [
        "PDF text extraction can still work for text-based PDFs.",
        "Real photo or scanned-image extraction should not be claimed when OCR is not configured."
      ]
    };
  }

  const activeProvider = provider || legacyProvider;
  const configured =
    (activeProvider === "openai" && hasConfiguredSecret(process.env.OPENAI_API_KEY)) ||
    (activeProvider === "google" && hasConfiguredSecret(process.env.GOOGLE_VISION_API_KEY)) ||
    (activeProvider === "azure" && hasConfiguredValue(process.env.AZURE_VISION_ENDPOINT) && hasConfiguredSecret(process.env.AZURE_VISION_KEY)) ||
    (activeProvider === "aws-textract" && hasConfiguredValue(process.env.AWS_ACCESS_KEY_ID) && hasConfiguredSecret(process.env.AWS_SECRET_ACCESS_KEY) && hasConfiguredValue(process.env.AWS_REGION)) ||
    activeProvider === "disabled";

  return {
    key: "ocr",
    label: "OCR / Vision",
    providerName: activeProvider,
    configured: configured && activeProvider !== "disabled",
    state: activeProvider === "disabled" ? "disabled" : configured ? "configured" : "not_configured",
    missingEnv: configured
      ? []
      : activeProvider === "openai"
        ? ["OPENAI_API_KEY"]
        : activeProvider === "google"
          ? ["GOOGLE_VISION_API_KEY"]
          : activeProvider === "azure"
            ? ["AZURE_VISION_ENDPOINT", "AZURE_VISION_KEY"]
            : activeProvider === "aws-textract"
              ? ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]
              : ["OCR_PROVIDER"],
    notes: [
      "Critical field extraction remains review-required on low confidence.",
      "Poor quality scans or photos must not auto-fill critical fields."
    ]
  };
}
