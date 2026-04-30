export type DocumentAiResult = {
  provider: string;
  model?: string;
  extractedText: string;
  extractedTextPreview: string;
  confidence: number;
  keyValues?: Array<{ key: string; value: string; confidence?: number }>;
  warnings: string[];
  configured: boolean;
};

function normalizeText(text: string, max = 30000) {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function preview(text: string) {
  return normalizeText(text, 1200);
}

async function extractBasic(bytes: Buffer, mimeType: string): Promise<DocumentAiResult> {
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("csv")) {
    const text = normalizeText(bytes.toString("utf8"));
    return {
      provider: "basic",
      model: "native-text",
      extractedText: text,
      extractedTextPreview: preview(text),
      confidence: text.length > 120 ? 0.86 : 0.65,
      warnings: text.length ? [] : ["No readable text content was found in this file."],
      configured: true
    };
  }

  if (mimeType === "application/pdf" || mimeType.includes("pdf")) {
    try {
      const pdfParse = require("pdf-parse");
      const parsed = await pdfParse(bytes);
      const text = normalizeText(parsed.text || "");
      if (text.length > 50) {
        return {
          provider: "basic",
          model: "pdf-parse",
          extractedText: text,
          extractedTextPreview: preview(text),
          confidence: text.length > 300 ? 0.82 : 0.68,
          warnings: [],
          configured: true
        };
      }

      return {
        provider: "basic",
        model: "pdf-parse",
        extractedText: "",
        extractedTextPreview: "",
        confidence: 0.2,
        warnings: ["PDF appears scanned or image-based. OCR provider is required for fuller extraction."],
        configured: true
      };
    } catch {
      return {
        provider: "basic",
        model: "pdf-parse",
        extractedText: "",
        extractedTextPreview: "",
        confidence: 0.15,
        warnings: ["PDF text extraction failed. OCR provider or manual review is required."],
        configured: true
      };
    }
  }

  if (mimeType.startsWith("image/")) {
    return {
      provider: "basic",
      model: "image-no-ocr",
      extractedText: "",
      extractedTextPreview: "",
      confidence: 0.1,
      warnings: ["Image document uploaded. OCR provider is required for readable extraction."],
      configured: true
    };
  }

  const text = normalizeText(
    bytes.toString("utf8").replace(/[^\x20-\x7E]+/g, " "),
    12000
  );
  return {
    provider: "basic",
    model: "fallback-text",
    extractedText: text,
    extractedTextPreview: preview(text),
    confidence: text.length > 50 ? 0.55 : 0.2,
    warnings: text.length ? ["Content was extracted with a generic fallback parser. Review required."] : ["No readable text was extracted from this file type."],
    configured: true
  };
}

async function extractWithAwsTextract(bytes: Buffer): Promise<DocumentAiResult> {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
    return {
      provider: "aws-textract",
      extractedText: "",
      extractedTextPreview: "",
      confidence: 0,
      warnings: ["OCR provider not configured. Add AWS Textract credentials to enable scanned/image extraction."],
      configured: false
    };
  }

  try {
    const awsTextract = (eval("require")("@aws-sdk/client-textract") as any);
    const TextractClient = awsTextract.TextractClient;
    const AnalyzeDocumentCommand = awsTextract.AnalyzeDocumentCommand;
    const client = new TextractClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const response = await client.send(new AnalyzeDocumentCommand({
      Document: { Bytes: new Uint8Array(bytes) },
      FeatureTypes: ["FORMS", "TABLES", "SIGNATURES"]
    }));

    const lines = (response.Blocks ?? []).filter((block: any) => block.BlockType === "LINE" && block.Text);
    const text = normalizeText(lines.map((line: any) => line.Text).join(" "));
    const keyBlocks = (response.Blocks ?? []).filter((block: any) => block.BlockType === "KEY_VALUE_SET");
    const confidence = lines.length
      ? Math.round((lines.reduce((sum: number, line: any) => sum + Number(line.Confidence || 0), 0) / lines.length)) / 100
      : 0.2;

    return {
      provider: "aws-textract",
      model: "AnalyzeDocument",
      extractedText: text,
      extractedTextPreview: preview(text),
      confidence,
      keyValues: keyBlocks.slice(0, 20).map((block: any) => ({
        key: block.EntityTypes?.join(",") || "field",
        value: block.Text || "",
        confidence: block.Confidence ? Math.round(block.Confidence) / 100 : undefined
      })),
      warnings: text.length ? [] : ["Textract returned little or no readable text. Manual review is required."],
      configured: true
    };
  } catch (error) {
    return {
      provider: "aws-textract",
      extractedText: "",
      extractedTextPreview: "",
      confidence: 0,
      warnings: [`OCR extraction failed: ${error instanceof Error ? error.message : "unknown error"}`],
      configured: true
    };
  }
}

export async function extractDocumentData(bytes: Buffer, mimeType: string): Promise<DocumentAiResult> {
  const provider = (process.env.DOCUMENT_AI_PROVIDER || "basic").toLowerCase();
  if (provider === "aws-textract") {
    return extractWithAwsTextract(bytes);
  }
  return extractBasic(bytes, mimeType);
}
