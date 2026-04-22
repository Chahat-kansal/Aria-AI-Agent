import { NextResponse } from "next/server";
import { runDocumentPipeline } from "@/lib/services/document-pipeline";

export async function POST(req: Request) {
  const body = await req.json();
  const fileName = typeof body.fileName === "string" ? body.fileName : "unknown.file";
  const pipeline = await runDocumentPipeline(fileName);

  return NextResponse.json({
    status: "accepted",
    message: "Upload recorded. Extraction pipeline queued for review-required processing.",
    pipeline
  });
}
