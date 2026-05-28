import type { ProviderStatus, ProviderTestResult } from "@/lib/providers/types";
import { hasConfiguredSecret, hasConfiguredValue } from "@/lib/providers/shared";

export function getEmailProviderStatus(): ProviderStatus {
  const provider = "resend";
  const configured =
    hasConfiguredSecret(process.env.RESEND_API_KEY) &&
    hasConfiguredValue(process.env.EMAIL_FROM) &&
    hasConfiguredValue(process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM);

  return {
    key: "email",
    label: "Email",
    providerName: configured ? provider : "not configured",
    configured,
    state: configured ? "configured" : "not_configured",
    missingEnv: configured ? [] : ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO"],
    notes: [
      "Portal and workflow emails must use secure app links only.",
      "No passport, DOB, grant, or raw document details are included in email bodies."
    ]
  };
}

export async function sendWithResend(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      reply_to: input.replyTo || process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend delivery failed (${response.status}): ${body.slice(0, 160)}`);
  }

  return response.json().catch(() => ({}));
}

export async function sendEmailProviderTest(to: string): Promise<ProviderTestResult> {
  const status = getEmailProviderStatus();
  if (!status.configured) {
    return { ok: false, reason: "Email provider is not configured.", providerName: status.providerName };
  }

  await sendWithResend({
    to,
    subject: "Aria integration test",
    text: "This is a safe Aria provider test email. Ready for agent final review.",
    html: "<p>This is a safe Aria provider test email.</p><p>Ready for agent final review.</p>"
  });

  return { ok: true, reason: "Test email sent.", providerName: status.providerName };
}
