import { NextResponse } from "next/server";
import { generateSeededAiReply } from "@/lib/services/ai-adapter";

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = typeof body.prompt === "string" ? body.prompt : "Summarize current matter";
  const reply = await generateSeededAiReply(prompt);

  return NextResponse.json({
    mode: body.matterId ? "matter-specific" : "workspace",
    reviewRequired: true,
    ...reply
  });
}
