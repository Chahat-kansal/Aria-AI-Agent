import { getOcrProviderStatus } from "@/lib/providers/ocr-provider";

async function main() {
  const status = getOcrProviderStatus();
  console.log(JSON.stringify({
    pass: true,
    provider: status.providerName,
    configured: status.configured,
    state: status.state,
    missing: status.missingEnv,
    notes: [
      "If OCR is not configured, Aria must report that photo/scanned extraction is unavailable.",
      "PDF text extraction can still operate for text-based PDFs."
    ]
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
