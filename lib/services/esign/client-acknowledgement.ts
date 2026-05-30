import { EsignStatus, Prisma, ResolutionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent, auditMatterAction } from "@/lib/services/audit";
import { sendClientWorkflowEmail } from "@/lib/services/email";
import { getEmailConfigStatus } from "@/lib/services/runtime-config";
import { getClientPortalById, getClientPortalByToken, ensureClientPortalToken, addMatterTimelineEvent } from "@/lib/services/client-workflows";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { decryptJson, encryptJson } from "@/lib/security/encryption";
import { sha256Hex } from "@/lib/security/hash";
import {
  type AcknowledgementDefinition,
  type AcknowledgementRequestType,
  type SubmittedAcknowledgementPayload,
  buildAcknowledgementDefinition,
  detectAcknowledgementRiskFlags,
  parseAcknowledgementSubmission
} from "@/lib/services/esign/esign-safety";
import { generateAcknowledgementRecord } from "@/lib/services/esign/acknowledgement-record";
import { redactEsignPayload, redactEsignText } from "@/lib/services/esign/esign-redaction";

function portalScopedWhere(portal: { clientId: string; matterId: string | null }) {
  return {
    clientId: portal.clientId,
    ...(portal.matterId ? { matterId: portal.matterId } : {})
  };
}

function parseRetainerTemplateConfigured(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const templateId = record.retainerTemplateId;
  return typeof templateId === "string" && templateId.trim().length > 0;
}

export async function getRetainerTemplateConfigured(workspaceId: string) {
  const settings = await prisma.workspaceOperationalSettings.findUnique({
    where: { workspaceId },
    select: { formsDefaultSettingsJson: true }
  });
  return parseRetainerTemplateConfigured(settings?.formsDefaultSettingsJson);
}

export async function createAcknowledgementRequest(input: {
  workspaceId: string;
  matterId: string;
  requestedByUserId: string;
  requestType: AcknowledgementRequestType;
  title?: string | null;
  customStatement?: string | null;
  expiresInDays?: number | null;
  notifyClient?: boolean;
  requestOrigin?: string | null;
}) {
  const matter = await prisma.matter.findFirstOrThrow({
    where: { id: input.matterId, workspaceId: input.workspaceId },
    include: { client: true, workspace: true }
  });
  const definition = await buildAcknowledgementDefinition({
    matterId: matter.id,
    requestType: input.requestType,
    title: input.title,
    customStatement: input.customStatement
  });
  if (definition.requiresRetainerTemplate && !(await getRetainerTemplateConfigured(input.workspaceId))) {
    throw new Error("Retainer template not configured.");
  }

  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000) : null;
  const request = await prisma.clientAcknowledgementRequest.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: matter.id,
      clientId: matter.clientId,
      requestedByUserId: input.requestedByUserId,
      provider: "internal_acknowledgement",
      status: EsignStatus.SENT,
      title: definition.title,
      requestType: definition.requestType,
      safeSummary: definition.safeSummary,
      requestJson: encryptJson(definition),
      sentAt: new Date(),
      expiresAt
    }
  });

  await prisma.esignEvent.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: matter.id,
      requestId: request.id,
      actorUserId: input.requestedByUserId,
      provider: "internal_acknowledgement",
      status: EsignStatus.SENT,
      action: "acknowledgement.request_sent",
      payloadPreviewJson: redactEsignPayload({
        requestType: definition.requestType,
        title: definition.title,
        safeSummary: definition.safeSummary,
        promptCount: definition.prompts.length
      })
    }
  });

  await addMatterTimelineEvent({
    workspaceId: input.workspaceId,
    matterId: matter.id,
    actorUserId: input.requestedByUserId,
    eventType: "acknowledgement.request_sent",
    title: "Client acknowledgement / confirmation sent",
    description: `${definition.title}. Agent review required before use.`
  });

  await auditMatterAction({
    workspaceId: input.workspaceId,
    userId: input.requestedByUserId,
    matterId: matter.id,
    action: "acknowledgement.request_created",
    metadata: redactEsignPayload({
      requestId: request.id,
      requestType: definition.requestType,
      provider: "internal_acknowledgement"
    })
  });
  await auditMatterAction({
    workspaceId: input.workspaceId,
    userId: input.requestedByUserId,
    matterId: matter.id,
    action: "acknowledgement.request_sent",
    metadata: redactEsignPayload({
      requestId: request.id,
      requestType: definition.requestType,
      provider: "internal_acknowledgement"
    })
  });

  let portalLink: string | null = null;
  let emailResult: { delivered: boolean; reason: string } | null = null;
  if (input.notifyClient) {
    const portalInvite = await ensureClientPortalToken({
      workspaceId: input.workspaceId,
      clientId: matter.clientId,
      matterId: matter.id,
      label: `Acknowledgement request ${request.id.slice(0, 8)}`,
      createdByUserId: input.requestedByUserId,
      requestOrigin: input.requestOrigin
    });
    portalLink = portalInvite.url;
    if (getEmailConfigStatus().configured && matter.client.email) {
      const email = await sendClientWorkflowEmail({
        to: matter.client.email,
        recipientName: `${matter.client.firstName} ${matter.client.lastName}`.trim(),
        workspaceName: matter.workspace.name,
        subject: `${matter.workspace.name}: secure confirmation request`,
        intro: "Your migration team has sent you a secure client acknowledgement / confirmation request. Please log in to your secure portal to review it.",
        actionLabel: "Open secure portal",
        actionLink: portalLink,
        footer: "This confirmation does not lodge an application. Your migration team will review this before use."
      });
      emailResult = { delivered: email.delivered, reason: email.reason };
    }
  }

  return { request, definition, portalLink, emailResult };
}

export async function listMatterAcknowledgementRequests(input: {
  workspaceId: string;
  matterId: string;
  user: { id: string; workspaceId: string; role: any; visibilityScope: any; status: any; permissionsJson: any };
}) {
  if (!hasPermission(input.user, "can_send_client_requests")) return null;
  const matter = await prisma.matter.findFirst({
    where: { id: input.matterId, ...scopedMatterWhere(input.user) },
    select: { id: true, clientId: true, title: true }
  });
  if (!matter) return null;

  const [requests, retainerTemplateConfigured] = await Promise.all([
    prisma.clientAcknowledgementRequest.findMany({
      where: { workspaceId: input.workspaceId, matterId: input.matterId },
      include: {
        response: true,
        record: true,
        requestedByUser: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    getRetainerTemplateConfigured(input.workspaceId)
  ]);

  return {
    retainerTemplateConfigured,
    requests: requests.map((request) => ({
      ...request,
      definition: request.requestJson ? decryptJson<AcknowledgementDefinition>(request.requestJson) : null
    }))
  };
}

async function getPortalScopedAcknowledgementRequestsFromPortal(portal: NonNullable<Awaited<ReturnType<typeof getClientPortalById>>>) {
  const requests = await prisma.clientAcknowledgementRequest.findMany({
    where: {
      workspaceId: portal.workspaceId,
      ...portalScopedWhere(portal),
      revokedAt: null
    },
    include: { response: true },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }]
  });
  return requests.map((request) => ({
    ...request,
    definition: request.requestJson ? decryptJson<AcknowledgementDefinition>(request.requestJson) : null
  }));
}

export async function getPortalAcknowledgementRequestsById(portalId: string) {
  const portal = await getClientPortalById(portalId);
  if (!portal) return null;
  return getPortalScopedAcknowledgementRequestsFromPortal(portal);
}

export async function getPortalAcknowledgementRequestsByToken(token: string) {
  const portal = await getClientPortalByToken(token);
  if (!portal) return null;
  return getPortalScopedAcknowledgementRequestsFromPortal(portal);
}

async function findPortalScopedAcknowledgement(input: { portalId?: string; token?: string; requestId: string }) {
  const portal = input.portalId ? await getClientPortalById(input.portalId) : await getClientPortalByToken(String(input.token));
  if (!portal) return { portal: null, request: null };
  const request = await prisma.clientAcknowledgementRequest.findFirst({
    where: {
      id: input.requestId,
      workspaceId: portal.workspaceId,
      ...portalScopedWhere(portal)
    },
    include: { response: true }
  });
  if (!request) return { portal, request: null };
  const definition = request.requestJson ? decryptJson<AcknowledgementDefinition>(request.requestJson) : null;
  return { portal, request: request ? { ...request, definition } : null };
}

export async function getPortalAcknowledgementRequestById(portalId: string, requestId: string) {
  const result = await findPortalScopedAcknowledgement({ portalId, requestId });
  return result.request;
}

export async function getPortalAcknowledgementRequestByToken(token: string, requestId: string) {
  const result = await findPortalScopedAcknowledgement({ token, requestId });
  return result.request;
}

export async function markAcknowledgementViewed(input: { portalId?: string; token?: string; requestId: string }) {
  const result = await findPortalScopedAcknowledgement(input);
  if (!result.portal || !result.request) return null;
  if (!result.request.viewedAt) {
    await prisma.clientAcknowledgementRequest.update({
      where: { id: result.request.id },
      data: { viewedAt: new Date(), status: EsignStatus.VIEWED }
    });
    await prisma.esignEvent.create({
      data: {
        workspaceId: result.portal.workspaceId,
        matterId: result.request.matterId,
        requestId: result.request.id,
        actorUserId: result.request.requestedByUserId,
        provider: result.request.provider,
        status: EsignStatus.VIEWED,
        action: "acknowledgement.request_viewed"
      }
    });
    await auditEvent({
      workspaceId: result.portal.workspaceId,
      userId: result.request.requestedByUserId,
      entityType: "ClientAcknowledgementRequest",
      entityId: result.request.id,
      action: "acknowledgement.request_viewed",
      metadata: { matterId: result.request.matterId, clientId: result.request.clientId }
    });
  }
  return result.request;
}

async function submitAcknowledgementInternal(
  portal: NonNullable<Awaited<ReturnType<typeof getClientPortalById>>>,
  request: Awaited<ReturnType<typeof getPortalAcknowledgementRequestById>>,
  payload: SubmittedAcknowledgementPayload,
  userAgent?: string | null,
  clientIp?: string | null
) {
  if (!request || !request.definition) return null;
  const expired = request.expiresAt && request.expiresAt < new Date();
  if (request.revokedAt) throw new Error("This acknowledgement request has been revoked.");
  if (expired) {
    await prisma.clientAcknowledgementRequest.update({
      where: { id: request.id },
      data: { status: EsignStatus.EXPIRED }
    }).catch(() => null);
    throw new Error("This acknowledgement request has expired.");
  }
  const flags = detectAcknowledgementRiskFlags(payload);
  const response = await prisma.clientAcknowledgementResponse.upsert({
    where: { requestId: request.id },
    update: {
      provider: request.provider,
      reviewStatus: flags.length ? "FLAGGED" : "AGENT_REVIEW_REQUIRED",
      submittedAt: new Date(payload.submittedAt),
      clientSessionId: portal.id,
      clientIpHash: clientIp ? sha256Hex(clientIp) : null,
      userAgentHash: userAgent ? sha256Hex(userAgent) : null,
      responseJson: encryptJson(payload),
      safeSummary: `${payload.answers.filter((item) => item.response === "needs_agent_follow_up").length} item(s) need follow-up.`,
      riskFlagsJson: flags as unknown as Prisma.InputJsonValue
    },
    create: {
      workspaceId: request.workspaceId,
      matterId: request.matterId,
      clientId: request.clientId,
      requestId: request.id,
      provider: request.provider,
      reviewStatus: flags.length ? "FLAGGED" : "AGENT_REVIEW_REQUIRED",
      submittedAt: new Date(payload.submittedAt),
      clientSessionId: portal.id,
      clientIpHash: clientIp ? sha256Hex(clientIp) : null,
      userAgentHash: userAgent ? sha256Hex(userAgent) : null,
      responseJson: encryptJson(payload),
      safeSummary: `${payload.answers.filter((item) => item.response === "needs_agent_follow_up").length} item(s) need follow-up.`,
      riskFlagsJson: flags as unknown as Prisma.InputJsonValue
    }
  });

  await prisma.clientAcknowledgementRequest.update({
    where: { id: request.id },
    data: {
      status: EsignStatus.SUBMITTED,
      submittedAt: response.submittedAt,
      latestClientSessionId: portal.id,
      latestClientIpHash: response.clientIpHash,
      latestUserAgentHash: response.userAgentHash
    }
  });

  for (const flag of flags) {
    await prisma.validationIssue.create({
      data: {
        matterId: request.matterId,
        severity: flag.severity,
        type: "CLIENT_ACKNOWLEDGEMENT_FLAG",
        title: flag.title,
        description: flag.description,
        relatedFieldKey: request.requestType,
        resolutionStatus: ResolutionStatus.OPEN
      }
    }).catch(() => null);
    await auditMatterAction({
      workspaceId: request.workspaceId,
      userId: request.requestedByUserId,
      matterId: request.matterId,
      action: "acknowledgement.risk_flag_created",
      metadata: redactEsignPayload({ code: flag.code, title: flag.title })
    }).catch(() => null);
  }

  await generateAcknowledgementRecord(request.id);
  await prisma.esignEvent.create({
    data: {
      workspaceId: request.workspaceId,
      matterId: request.matterId,
      requestId: request.id,
      actorUserId: request.requestedByUserId,
      provider: request.provider,
      status: EsignStatus.SUBMITTED,
      action: "acknowledgement.request_submitted",
      payloadPreviewJson: redactEsignPayload({
        requestType: request.requestType,
        answers: payload.answers.map((item) => ({ key: item.key, response: item.response }))
      })
    }
  });
  await addMatterTimelineEvent({
    workspaceId: request.workspaceId,
    matterId: request.matterId,
    actorUserId: request.requestedByUserId,
    eventType: "acknowledgement.request_submitted",
    title: "Client acknowledgement / confirmation submitted",
    description: `${request.title}. Agent review required before use.`
  });
  await auditMatterAction({
    workspaceId: request.workspaceId,
    userId: request.requestedByUserId,
    matterId: request.matterId,
    action: "acknowledgement.request_submitted",
    metadata: redactEsignPayload({
      requestId: request.id,
      requestType: request.requestType,
      reviewStatus: response.reviewStatus
    })
  }).catch(() => null);
  await auditMatterAction({
    workspaceId: request.workspaceId,
    userId: request.requestedByUserId,
    matterId: request.matterId,
    action: "acknowledgement.record_generated",
    metadata: { requestId: request.id }
  }).catch(() => null);

  return response;
}

export async function submitAcknowledgementByPortalId(input: {
  portalId: string;
  requestId: string;
  formData: FormData;
  userAgent?: string | null;
  clientIp?: string | null;
}) {
  const { portal, request } = await findPortalScopedAcknowledgement({ portalId: input.portalId, requestId: input.requestId });
  if (!portal || !request?.definition) return null;
  const payload = parseAcknowledgementSubmission(input.formData, request.definition);
  return submitAcknowledgementInternal(portal, request, payload, input.userAgent, input.clientIp);
}

export async function submitAcknowledgementByToken(input: {
  token: string;
  requestId: string;
  formData: FormData;
  userAgent?: string | null;
  clientIp?: string | null;
}) {
  const { portal, request } = await findPortalScopedAcknowledgement({ token: input.token, requestId: input.requestId });
  if (!portal || !request?.definition) return null;
  const payload = parseAcknowledgementSubmission(input.formData, request.definition);
  return submitAcknowledgementInternal(portal, request, payload, input.userAgent, input.clientIp);
}

export async function resendAcknowledgementRequest(input: {
  workspaceId: string;
  requestId: string;
  userId: string;
  requestOrigin?: string | null;
}) {
  const request = await prisma.clientAcknowledgementRequest.findFirstOrThrow({
    where: { id: input.requestId, workspaceId: input.workspaceId },
    include: { client: true, matter: { include: { workspace: true } } }
  });
  const portalInvite = await ensureClientPortalToken({
    workspaceId: input.workspaceId,
    clientId: request.clientId,
    matterId: request.matterId,
    label: `Acknowledgement resend ${request.id.slice(0, 8)}`,
    createdByUserId: input.userId,
    requestOrigin: input.requestOrigin
  });
  let delivered = false;
  let reason = "Manual secure portal fallback required.";
  if (getEmailConfigStatus().configured && request.client.email) {
    const email = await sendClientWorkflowEmail({
      to: request.client.email,
      recipientName: `${request.client.firstName} ${request.client.lastName}`.trim(),
      workspaceName: request.matter.workspace.name,
      subject: `${request.matter.workspace.name}: secure confirmation reminder`,
      intro: "Your migration team has re-sent a secure client acknowledgement / confirmation request. Please log in to your secure portal to review it.",
      actionLabel: "Open secure portal",
      actionLink: portalInvite.url,
      footer: "This confirmation does not lodge an application. Your migration team will review this before use."
    });
    delivered = email.delivered;
    reason = email.reason;
  }
  await prisma.clientAcknowledgementRequest.update({
    where: { id: request.id },
    data: {
      sentAt: new Date(),
      revokedAt: null,
      status: EsignStatus.SENT,
      lastErrorSummary: delivered ? null : redactEsignText(reason)
    }
  });
  await prisma.esignEvent.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: request.matterId,
      requestId: request.id,
      actorUserId: input.userId,
      provider: request.provider,
      status: EsignStatus.SENT,
      action: "acknowledgement.request_resent"
    }
  });
  await auditMatterAction({
    workspaceId: input.workspaceId,
    userId: input.userId,
    matterId: request.matterId,
    action: "acknowledgement.request_resent",
    metadata: { requestId: request.id }
  });
  return { delivered, reason, portalLink: portalInvite.url };
}

export async function revokeAcknowledgementRequest(input: {
  workspaceId: string;
  requestId: string;
  userId: string;
}) {
  const request = await prisma.clientAcknowledgementRequest.update({
    where: { id: input.requestId },
    data: {
      revokedAt: new Date(),
      status: EsignStatus.REVOKED
    }
  });
  await prisma.esignEvent.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: request.matterId,
      requestId: request.id,
      actorUserId: input.userId,
      provider: request.provider,
      status: EsignStatus.REVOKED,
      action: "acknowledgement.request_revoked"
    }
  });
  await auditMatterAction({
    workspaceId: input.workspaceId,
    userId: input.userId,
    matterId: request.matterId,
    action: "acknowledgement.request_revoked",
    metadata: { requestId: request.id }
  });
  return request;
}
