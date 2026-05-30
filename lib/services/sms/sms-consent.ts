import { SmsConsentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { getOrCreateWorkspaceOperationalSettings } from "@/lib/services/workspace-operational-settings";

export async function getSmsConsentRecord(workspaceId: string, clientId: string) {
  return prisma.smsConsent.findUnique({
    where: { workspaceId_clientId: { workspaceId, clientId } }
  });
}

export async function getSmsConsentSummary(workspaceId: string) {
  const [consents, optOuts] = await Promise.all([
    prisma.smsConsent.findMany({
      where: { workspaceId },
      include: { client: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { updatedAt: "desc" },
      take: 12
    }),
    prisma.smsOptOut.findMany({
      where: { workspaceId },
      include: { client: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 12
    })
  ]);

  return { consents, optOuts };
}

export async function recordSmsConsent(input: {
  workspaceId: string;
  clientId: string;
  userId?: string | null;
  source?: string | null;
  notesRedacted?: string | null;
}) {
  const consent = await prisma.smsConsent.upsert({
    where: { workspaceId_clientId: { workspaceId: input.workspaceId, clientId: input.clientId } },
    create: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      recordedByUserId: input.userId || null,
      consentStatus: SmsConsentStatus.CONSENTED,
      source: input.source || "workspace_recorded",
      notesRedacted: input.notesRedacted || null,
      consentRecordedAt: new Date()
    },
    update: {
      recordedByUserId: input.userId || null,
      consentStatus: SmsConsentStatus.CONSENTED,
      source: input.source || "workspace_recorded",
      notesRedacted: input.notesRedacted || null,
      consentRecordedAt: new Date(),
      optOutAt: null
    }
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId || undefined,
    entityType: "SmsConsent",
    entityId: consent.id,
    action: "sms.consent_recorded",
    metadata: { clientId: input.clientId, consentStatus: consent.consentStatus }
  });

  return consent;
}

export async function recordSmsOptOut(input: {
  workspaceId: string;
  clientId: string;
  userId?: string | null;
  reason?: string | null;
}) {
  const consent = await prisma.smsConsent.upsert({
    where: { workspaceId_clientId: { workspaceId: input.workspaceId, clientId: input.clientId } },
    create: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      recordedByUserId: input.userId || null,
      consentStatus: SmsConsentStatus.OPTED_OUT,
      source: "opt_out",
      optOutAt: new Date()
    },
    update: {
      recordedByUserId: input.userId || null,
      consentStatus: SmsConsentStatus.OPTED_OUT,
      source: "opt_out",
      optOutAt: new Date()
    }
  });

  await prisma.smsOptOut.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      recordedByUserId: input.userId || null,
      reason: input.reason || null
    }
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId || undefined,
    entityType: "SmsConsent",
    entityId: consent.id,
    action: "sms.opted_out",
    metadata: { clientId: input.clientId, reason: input.reason || "recorded" }
  });

  return consent;
}

export async function checkSmsConsent(input: {
  workspaceId: string;
  clientId?: string | null;
  isAgentAlert?: boolean;
}) {
  const settings = await getOrCreateWorkspaceOperationalSettings(input.workspaceId);
  if (input.isAgentAlert) {
    return {
      allowed: Boolean(settings.smsEnabled && settings.smsAgentAlertsEnabled),
      consentStatus: SmsConsentStatus.INTERNAL_ONLY,
      reason: settings.smsEnabled && settings.smsAgentAlertsEnabled ? "agent_alert_allowed" : "workspace_sms_disabled"
    };
  }

  if (!settings.smsEnabled) {
    return {
      allowed: false,
      consentStatus: SmsConsentStatus.UNKNOWN,
      reason: "workspace_sms_disabled"
    };
  }

  if (!input.clientId) {
    return {
      allowed: false,
      consentStatus: SmsConsentStatus.UNKNOWN,
      reason: "client_required"
    };
  }

  const consent = await getSmsConsentRecord(input.workspaceId, input.clientId);
  if (consent?.consentStatus === SmsConsentStatus.OPTED_OUT) {
    return { allowed: false, consentStatus: SmsConsentStatus.OPTED_OUT, reason: "client_opted_out" };
  }
  if (!settings.smsClientConsentRequired) {
    return {
      allowed: true,
      consentStatus: consent?.consentStatus ?? SmsConsentStatus.UNKNOWN,
      reason: "workspace_policy_allows_send"
    };
  }
  if (consent?.consentStatus === SmsConsentStatus.CONSENTED) {
    return { allowed: true, consentStatus: SmsConsentStatus.CONSENTED, reason: "consent_recorded" };
  }
  return {
    allowed: false,
    consentStatus: consent?.consentStatus ?? SmsConsentStatus.UNKNOWN,
    reason: "sms_consent_not_recorded"
  };
}
