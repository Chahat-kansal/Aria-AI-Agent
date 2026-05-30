import { Prisma, SmsConsentStatus, SmsStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { serverLog } from "@/lib/services/runtime-config";
import { getSmsProviderRouter } from "@/lib/services/sms/sms-provider-router";
import { checkSmsRateLimit } from "@/lib/services/sms/sms-rate-limit";
import { redactSmsErrorSummary, redactSmsMetadata, redactSmsPreview, getRecipientLast4, hashPhoneNumber, maskPhoneNumber } from "@/lib/services/sms/sms-redaction";
import { assertSafeSmsBody } from "@/lib/services/sms/sms-safety";
import { buildSmsTemplate, type SmsTemplateInput, type SmsTemplateKey } from "@/lib/services/sms/sms-templates";
import { encryptString } from "@/lib/security/encryption";

export type SendSmsInput = {
  to: string;
  body?: string;
  templateKey?: SmsTemplateKey;
  templateInput?: SmsTemplateInput;
  workspaceId: string;
  userId?: string;
  matterId?: string | null;
  clientId?: string | null;
  dryRun?: boolean;
  isAgentAlert?: boolean;
  rateLimitKey?: string;
  allowWithoutConsent?: boolean;
};

async function recordSmsEvent(input: {
  workspaceId: string;
  userId?: string;
  smsMessageId?: string | null;
  eventType: string;
  status: SmsStatus;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.smsEvent.create({
    data: {
      workspaceId: input.workspaceId,
      smsMessageId: input.smsMessageId || null,
      userId: input.userId || null,
      eventType: input.eventType,
      status: input.status,
      summary: input.summary || null,
      metadataJson: redactSmsMetadata(input.metadata ?? {}) as Prisma.InputJsonObject
    }
  });
}

export async function sendSms(input: SendSmsInput) {
  const router = getSmsProviderRouter();
  const recipient = router.validateRecipient(input.to);
  if (!recipient.ok || !recipient.normalized) {
    return { delivered: false, reason: recipient.reason || "Recipient phone number is invalid.", status: SmsStatus.FAILED };
  }

  const body = input.body
    ? assertSafeSmsBody(input.body)
    : input.templateKey
      ? buildSmsTemplate(input.templateKey, input.templateInput || { firmName: "Aria" })
      : "";

  const consent = await router.checkConsent({
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    isAgentAlert: input.isAgentAlert
  });

  const consentAllowed = input.allowWithoutConsent || input.isAgentAlert || consent.allowed;
  const rateKey = input.rateLimitKey || `sms:${input.workspaceId}:${input.clientId || recipient.normalized.slice(-6)}`;
  const rateLimit = checkSmsRateLimit({ key: rateKey });
  const preview = redactSmsPreview(body);
  const provider = router.getProviderStatus().providerName;
  const message = await prisma.smsMessage.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: input.matterId || null,
      clientId: input.clientId || null,
      userId: input.userId || null,
      provider,
      recipientEncrypted: encryptString(recipient.normalized),
      recipientHash: hashPhoneNumber(recipient.normalized),
      recipientLast4: getRecipientLast4(recipient.normalized),
      templateKey: input.templateKey || null,
      messagePreviewRedacted: preview,
      status: SmsStatus.DRAFT,
      consentStatus: input.isAgentAlert ? SmsConsentStatus.INTERNAL_ONLY : consent.consentStatus
    }
  });

  if (!consentAllowed) {
    await prisma.smsMessage.update({
      where: { id: message.id },
      data: {
        status: consent.consentStatus === SmsConsentStatus.OPTED_OUT ? SmsStatus.OPTED_OUT : SmsStatus.BLOCKED_NO_CONSENT,
        failedAt: new Date(),
        lastError: redactSmsErrorSummary(consent.reason)
      }
    });
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "SmsMessage",
      entityId: message.id,
      action: "sms.blocked_no_consent",
      metadata: { clientId: input.clientId, reason: consent.reason, recipient: maskPhoneNumber(recipient.normalized) }
    });
    await recordSmsEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      smsMessageId: message.id,
      eventType: "sms.blocked_no_consent",
      status: consent.consentStatus === SmsConsentStatus.OPTED_OUT ? SmsStatus.OPTED_OUT : SmsStatus.BLOCKED_NO_CONSENT,
      summary: consent.reason,
      metadata: { clientId: input.clientId, recipient: recipient.normalized }
    });
    return {
      delivered: false,
      reason: consent.reason,
      status: consent.consentStatus === SmsConsentStatus.OPTED_OUT ? SmsStatus.OPTED_OUT : SmsStatus.BLOCKED_NO_CONSENT
    };
  }

  if (!rateLimit.allowed) {
    await prisma.smsMessage.update({
      where: { id: message.id },
      data: {
        status: SmsStatus.BLOCKED_RATE_LIMITED,
        failedAt: new Date(),
        lastError: "rate_limited"
      }
    });
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "SmsMessage",
      entityId: message.id,
      action: "sms.blocked_rate_limited",
      metadata: { recipient: maskPhoneNumber(recipient.normalized), key: rateKey }
    });
    await recordSmsEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      smsMessageId: message.id,
      eventType: "sms.blocked_rate_limited",
      status: SmsStatus.BLOCKED_RATE_LIMITED,
      summary: "rate_limited",
      metadata: { recipient: recipient.normalized }
    });
    return { delivered: false, reason: "SMS sending is temporarily rate limited.", status: SmsStatus.BLOCKED_RATE_LIMITED };
  }

  const result = await router.sendSms({
    to: recipient.normalized,
    body,
    dryRun: input.dryRun
  });

  await prisma.smsMessage.update({
    where: { id: message.id },
    data: {
      providerMessageId: result.providerMessageId || null,
      status: result.status,
      sentAt: result.ok ? new Date() : null,
      failedAt: result.ok ? null : new Date(),
      lastError: result.ok ? null : redactSmsErrorSummary(result.reason),
      providerMetadataJson: result.payloadPreview ? { payloadPreview: result.payloadPreview } : undefined
    }
  });

  const auditAction = result.ok
    ? input.templateKey ? "sms.template_sent" : "sms.sent"
    : result.status === SmsStatus.NOT_CONFIGURED ? "sms.provider_not_configured" : "sms.failed";

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "SmsMessage",
    entityId: message.id,
    action: auditAction,
    metadata: {
      provider,
      templateKey: input.templateKey || null,
      status: result.status,
      recipient: maskPhoneNumber(recipient.normalized),
      reason: result.ok ? result.reason : redactSmsErrorSummary(result.reason)
    }
  });
  if (input.rateLimitKey?.startsWith("provider.sms.test:")) {
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "Provider",
      entityId: "sms",
      action: result.ok ? "provider.sms.test_success" : "provider.sms.test_failed",
      metadata: {
        provider,
        recipient: maskPhoneNumber(recipient.normalized),
        reason: result.ok ? result.reason : redactSmsErrorSummary(result.reason)
      }
    });
    await auditEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType: "SmsProvider",
      entityId: provider,
      action: "sms.provider_tested",
      metadata: {
        provider,
        success: result.ok,
        recipient: maskPhoneNumber(recipient.normalized)
      }
    });
  }
  await recordSmsEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    smsMessageId: message.id,
    eventType: auditAction,
    status: result.status,
    summary: result.reason,
    metadata: { templateKey: input.templateKey || null, recipient: recipient.normalized }
  });

  if (!result.ok) {
    serverLog("sms.delivery_failed", {
      provider,
      recipient: recipient.normalized,
      reason: result.reason
    });
  }

  return { delivered: result.ok, reason: result.reason, status: result.status };
}

export async function sendTemplateSms(input: Omit<SendSmsInput, "body"> & { templateKey: SmsTemplateKey; templateInput: SmsTemplateInput }) {
  return sendSms(input);
}

export async function sendPortalRequestSmsReminder(input: {
  workspaceId: string;
  userId?: string;
  clientId: string;
  matterId?: string | null;
  to: string;
  firmName: string;
}) {
  return sendTemplateSms({
    workspaceId: input.workspaceId,
    userId: input.userId,
    clientId: input.clientId,
    matterId: input.matterId,
    to: input.to,
    templateKey: "portal_request",
    templateInput: { firmName: input.firmName }
  });
}

export async function sendDocumentReminderSms(input: {
  workspaceId: string;
  userId?: string;
  clientId: string;
  matterId?: string | null;
  to: string;
  firmName: string;
}) {
  return sendTemplateSms({ ...input, templateKey: "document_reminder", templateInput: { firmName: input.firmName } });
}

export async function sendConfirmationReminderSms(input: {
  workspaceId: string;
  userId?: string;
  clientId: string;
  matterId?: string | null;
  to: string;
  firmName: string;
}) {
  return sendTemplateSms({ ...input, templateKey: "confirmation_reminder", templateInput: { firmName: input.firmName } });
}

export async function sendAppointmentReminderSms(input: {
  workspaceId: string;
  userId?: string;
  clientId: string;
  matterId?: string | null;
  to: string;
  firmName: string;
  appointmentTimeLabel?: string | null;
}) {
  return sendTemplateSms({
    ...input,
    templateKey: "appointment_reminder",
    templateInput: { firmName: input.firmName, appointmentTimeLabel: input.appointmentTimeLabel || null }
  });
}

export async function sendAgentDeadlineAlertSms(input: {
  workspaceId: string;
  userId?: string;
  to: string;
}) {
  return sendTemplateSms({
    workspaceId: input.workspaceId,
    userId: input.userId,
    to: input.to,
    templateKey: "deadline_agent_alert",
    templateInput: { firmName: "Aria" },
    isAgentAlert: true,
    allowWithoutConsent: true
  });
}

export async function sendPortalMessageNotificationSms(input: {
  workspaceId: string;
  userId?: string;
  clientId: string;
  matterId?: string | null;
  to: string;
  firmName: string;
}) {
  return sendTemplateSms({ ...input, templateKey: "message_notification", templateInput: { firmName: input.firmName } });
}

export async function sendInvoiceOverdueSms(input: {
  workspaceId: string;
  userId?: string;
  clientId: string;
  matterId?: string | null;
  to: string;
  firmName: string;
}) {
  return sendTemplateSms({ ...input, templateKey: "invoice_overdue", templateInput: { firmName: input.firmName } });
}
