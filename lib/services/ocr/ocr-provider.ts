import { getOcrProviderStatus } from "@/lib/providers/ocr-provider";

export type OcrExtractionResult = {
  provider: string;
  model?: string;
  extractedText: string;
  confidence: number;
  warnings: string[];
  configured: boolean;
};

async function runOpenAiVisionOcr(bytes: Buffer, mimeType: string): Promise<OcrExtractionResult> {
  const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OCR_OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Extract readable text from this migration document image. Return strict JSON with keys extractedText, confidence, warnings. Do not infer missing values. If text is unreadable, say so clearly."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract visible text only. Do not invent fields." },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ]
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI OCR failed (${response.status}): ${body.slice(0, 160)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = typeof content === "string" ? JSON.parse(content) : {};
  return {
    provider: "openai",
    model: process.env.OCR_OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini",
    extractedText: String(parsed.extractedText || "").trim(),
    confidence: Number(parsed.confidence || 0.45),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    configured: true
  };
}

export async function extractImageTextWithProvider(bytes: Buffer, mimeType: string): Promise<OcrExtractionResult> {
  const status = getOcrProviderStatus();
  if (!status.configured) {
    return {
      provider: status.providerName,
      extractedText: "",
      confidence: 0,
      warnings: [
        "text_extraction_empty: OCR provider not configured, so scanned/photo extraction is unavailable.",
        "needs_manual_review: Upload a clearer PDF or configure OCR before relying on image extraction."
      ],
      configured: false
    };
  }

  if (status.providerName === "openai") {
    return runOpenAiVisionOcr(bytes, mimeType);
  }

  return {
    provider: status.providerName,
    extractedText: "",
    confidence: 0,
    warnings: [
      `text_extraction_empty: OCR provider adapter for ${status.providerName} is not implemented in this build.`,
      "needs_manual_review: Manual review is required until a live provider adapter is enabled."
    ],
    configured: true
  };
}
