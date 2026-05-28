import { auditEvent } from "@/lib/services/audit";
import { serverLog } from "@/lib/services/runtime-config";
import { getEmailProviderStatus, sendWithResend } from "@/lib/providers/email-provider";
import { buildEmailTemplate, type EmailTemplateInput, type EmailTemplateName } from "@/lib/services/email/templates";

export type SendEmailInput = {
  to: string;
  template: EmailTemplateName;
  templateInput: EmailTemplateInput;
  workspaceId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  fallbackLink?: string;
};

export async function sendEmail(input: SendEmailInput) {
  const status = getEmailProviderStatus();
  if (!status.configured) {
    serverLog("email.not_configured", { to: input.to, provider: status.providerName, missing: status.missingEnv });
    if (input.workspaceId && input.userId) {
      await auditEvent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        entityType: "Provider",
        entityId: "email",
        action: "provider.email.test_failed",
        metadata: { reason: "Email provider is not configured." }
      });
    }
    return {
      delivered: false,
      reason: "Email is not configured. Use the secure manual fallback.",
      link: input.fallbackLink
    };
  }

  const template = buildEmailTemplate(input.template, input.templateInput);
  try {
    await sendWithResend({
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html
    });
    if (input.workspaceId && input.userId) {
      await auditEvent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        entityType: "Provider",
        entityId: "email",
        action: "provider.email.test_success",
        metadata: { template: input.template, ...(input.metadata || {}) }
      });
    }
    return { delivered: true, reason: "Email sent.", link: input.fallbackLink };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    serverLog("email.delivery_failed", { to: input.to, provider: status.providerName, error: message });
    if (input.workspaceId && input.userId) {
      await auditEvent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        entityType: "Provider",
        entityId: "email",
        action: "provider.email.test_failed",
        metadata: { reason: message, template: input.template, ...(input.metadata || {}) }
      });
    }
    return {
      delivered: false,
      reason: "Email delivery failed. Use the secure manual fallback.",
      link: input.fallbackLink
    };
  }
}
