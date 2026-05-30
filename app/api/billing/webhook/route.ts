import { NextResponse } from "next/server";
import { handleStripeWebhookEvent } from "@/lib/services/payments/stripe-webhooks";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  const result = await handleStripeWebhookEvent({
    payload,
    signatureHeader: signature
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Webhook rejected." }, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
  }

  return NextResponse.json({ received: true }, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
