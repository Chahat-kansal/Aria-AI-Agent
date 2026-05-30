import { MatterStage, MatterStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import { getEsignProviderAdapter } from "@/lib/services/esign/esign-provider-router";
import { getEsignProviderStatus } from "@/lib/providers/esign-provider";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { ensureClientPortalToken } from "@/lib/services/client-workflows";
import {
  createAcknowledgementRequest,
  getPortalAcknowledgementRequestByToken,
  getPortalAcknowledgementRequestsByToken,
  getRetainerTemplateConfigured,
  resendAcknowledgementRequest,
  revokeAcknowledgementRequest,
  submitAcknowledgementByToken
} from "@/lib/services/esign/client-acknowledgement";
import { getAuditRows, getWorkspaceDetail, safeJson } from "@/lib/services/platform-admin-data";
import { auditEvent } from "@/lib/services/audit";

loadScriptEnv();

type Check = { name: string; pass: boolean; detail?: string };

const WORKSPACE_SLUG = "esign-readiness";

function setEnv(overrides: Record<string, string | undefined>) {
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  });
  return () => {
    Object.entries(previous).forEach(([key, value]) => {
      if (typeof value === "undefined") delete process.env[key];
      else process.env[key] = value;
    });
  };
}

async function seedWorkspace() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Esign Readiness", plan: WorkspacePlan.PRO },
    create: { slug: WORKSPACE_SLUG, name: "Esign Readiness", plan: WorkspacePlan.PRO }
  });

  const agentA = await prisma.user.upsert({
    where: { email: "esign-agent-a@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Esign Agent A",
      email: "esign-agent-a@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const agentB = await prisma.user.upsert({
    where: { email: "esign-agent-b@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Esign Agent B",
      email: "esign-agent-b@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const clientA = await prisma.client.upsert({
    where: { clientReference: "ESIGN-READY-A" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agentA.id,
      email: "esign-client-a@example.com",
      phone: "0400000201"
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "ESIGN-READY-A",
      firstName: "Esign",
      lastName: "Client A",
      dob: new Date("1990-01-01T00:00:00.000Z"),
      nationality: "Test",
      email: "esign-client-a@example.com",
      phone: "0400000201",
      assignedToUserId: agentA.id
    }
  });

  const clientB = await prisma.client.upsert({
    where: { clientReference: "ESIGN-READY-B" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agentB.id,
      email: "esign-client-b@example.com",
      phone: "0400000202"
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "ESIGN-READY-B",
      firstName: "Esign",
      lastName: "Client B",
      dob: new Date("1991-01-01T00:00:00.000Z"),
      nationality: "Test",
      email: "esign-client-b@example.com",
      phone: "0400000202",
      assignedToUserId: agentB.id
    }
  });

  const matterA = await prisma.matter.upsert({
    where: { matterReference: "ESIGN-READY-MATTER-A" },
    update: { workspaceId: workspace.id, clientId: clientA.id, assignedToUserId: agentA.id },
    create: {
      workspaceId: workspace.id,
      matterReference: "ESIGN-READY-MATTER-A",
      clientId: clientA.id,
      assignedToUserId: agentA.id,
      title: "Esign Readiness Matter A",
      visaSubclass: "820/801",
      visaStream: "Partner",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 44
    }
  });

  const matterB = await prisma.matter.upsert({
    where: { matterReference: "ESIGN-READY-MATTER-B" },
    update: { workspaceId: workspace.id, clientId: clientB.id, assignedToUserId: agentB.id },
    create: {
      workspaceId: workspace.id,
      matterReference: "ESIGN-READY-MATTER-B",
      clientId: clientB.id,
      assignedToUserId: agentB.id,
      title: "Esign Readiness Matter B",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 41
    }
  });

  await prisma.esignEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.acknowledgementRecord.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.clientAcknowledgementResponse.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.clientAcknowledgementRequest.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.validationIssue.deleteMany({ where: { matterId: { in: [matterA.id, matterB.id] }, type: "CLIENT_ACKNOWLEDGEMENT_FLAG" } });

  const portalA = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: clientA.id,
    matterId: matterA.id,
    label: "Esign readiness portal A",
    createdByUserId: agentA.id
  });
  const portalB = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: clientB.id,
    matterId: matterB.id,
    label: "Esign readiness portal B",
    createdByUserId: agentB.id
  });

  return { workspace, agentA, agentB, clientA, clientB, matterA, matterB, portalA, portalB };
}

function buildSubmissionForm(request: NonNullable<Awaited<ReturnType<typeof getPortalAcknowledgementRequestByToken>>>, followUp = false) {
  const formData = new FormData();
  formData.set("statementAccepted", "on");
  for (const prompt of request.definition?.prompts || []) {
    formData.set(`response__${prompt.key}`, followUp && prompt.highImpact ? "needs_agent_follow_up" : "confirmed");
    formData.set(`detail__${prompt.key}`, followUp && prompt.highImpact ? "Prior refusal and police issue disclosed for migration agent review." : `Confirmed for ${prompt.title}.`);
  }
  return formData;
}

async function main() {
  const checks: Check[] = [];
  const seeded = await seedWorkspace();

  const restoreInternal = setEnv({ ESIGN_PROVIDER: "internal_acknowledgement" });
  const internalStatus = getEsignProviderStatus();
  checks.push({
    name: "Internal acknowledgement provider state passes",
    pass: internalStatus.configured && internalStatus.providerName === "internal_acknowledgement" && !/legally binding/i.test(internalStatus.notes.join(" "))
  });
  restoreInternal();

  const restoreDocuSignMissing = setEnv({
    ESIGN_PROVIDER: "docusign",
    DOCUSIGN_INTEGRATION_KEY: "",
    DOCUSIGN_USER_ID: "",
    DOCUSIGN_ACCOUNT_ID: "",
    DOCUSIGN_PRIVATE_KEY: "",
    DOCUSIGN_BASE_URL: "",
    DOCUSIGN_REDIRECT_URI: ""
  });
  const docusignMissing = getEsignProviderStatus();
  checks.push({
    name: "DocuSign config missing state is clear",
    pass: docusignMissing.state === "not_configured" && docusignMissing.missingEnv.includes("DOCUSIGN_INTEGRATION_KEY")
  });
  restoreDocuSignMissing();

  const restoreDisabled = setEnv({ ESIGN_PROVIDER: "disabled" });
  const disabledStatus = getEsignProviderStatus();
  checks.push({
    name: "Disabled state is clear",
    pass: disabledStatus.state === "disabled" && /disabled/i.test(disabledStatus.disabledReason || "")
  });
  restoreDisabled();

  checks.push({
    name: "Provider tokens use encrypted token vault path if external provider configured",
    pass: /upsertWorkspaceProviderConnection/.test(readFileSync("lib/services/esign/esign-provider-router.ts", "utf8"))
  });

  const request = await createAcknowledgementRequest({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matterA.id,
    requestedByUserId: seeded.agentA.id,
    requestType: "PERSONAL_DETAILS",
    notifyClient: false
  });
  checks.push({
    name: "Acknowledgement request can be created for dummy matter",
    pass: request.request.status === "SENT" && request.definition.prompts.length > 0
  });

  const portalARequests = await getPortalAcknowledgementRequestsByToken(seeded.portalA.token);
  checks.push({
    name: "Request appears in client portal scope only",
    pass: Boolean(portalARequests?.some((item) => item.id === request.request.id))
  });

  const wrongClientAccess = await getPortalAcknowledgementRequestByToken(seeded.portalB.token, request.request.id);
  checks.push({
    name: "Wrong client cannot access request",
    pass: wrongClientAccess === null
  });

  const requestForSubmit = await getPortalAcknowledgementRequestByToken(seeded.portalA.token, request.request.id);
  if (!requestForSubmit) throw new Error("Unable to load created acknowledgement request.");
  const submitted = await submitAcknowledgementByToken({
    token: seeded.portalA.token,
    requestId: request.request.id,
    formData: buildSubmissionForm(requestForSubmit),
    clientIp: "127.0.0.1",
    userAgent: "EsignReadiness/1.0"
  });
  checks.push({
    name: "Client can submit acknowledgement",
    pass: Boolean(submitted)
  });
  checks.push({
    name: "Submitted acknowledgement stays agent-review-required",
    pass: submitted?.reviewStatus === "AGENT_REVIEW_REQUIRED"
  });

  const riskyRequest = await createAcknowledgementRequest({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matterA.id,
    requestedByUserId: seeded.agentA.id,
    requestType: "HEALTH_CHARACTER",
    notifyClient: false
  });
  const riskyPortalRequest = await getPortalAcknowledgementRequestByToken(seeded.portalA.token, riskyRequest.request.id);
  if (!riskyPortalRequest) throw new Error("Unable to load risky acknowledgement request.");
  const riskySubmitted = await submitAcknowledgementByToken({
    token: seeded.portalA.token,
    requestId: riskyRequest.request.id,
    formData: buildSubmissionForm(riskyPortalRequest, true),
    clientIp: "127.0.0.1",
    userAgent: "EsignReadiness/1.0"
  });
  const riskIssues = await prisma.validationIssue.findMany({
    where: { matterId: seeded.matterA.id, type: "CLIENT_ACKNOWLEDGEMENT_FLAG" }
  });
  checks.push({
    name: "Risky answer creates review flag blocker",
    pass: riskySubmitted?.reviewStatus === "FLAGGED" && riskIssues.length > 0
  });

  let retainerBlocked = false;
  try {
    await createAcknowledgementRequest({
      workspaceId: seeded.workspace.id,
      matterId: seeded.matterA.id,
      requestedByUserId: seeded.agentA.id,
      requestType: "RETAINER_ACKNOWLEDGEMENT",
      notifyClient: false
    });
  } catch (error) {
    retainerBlocked = /Retainer template not configured/i.test(error instanceof Error ? error.message : String(error));
  }
  checks.push({
    name: "Retainer template not configured state is honest",
    pass: !(await getRetainerTemplateConfigured(seeded.workspace.id)) && retainerBlocked
  });

  const docusignAdapter = getEsignProviderAdapter("docusign");
  const dryRunEnvelope = docusignAdapter.dryRunExternalEnvelopePayload({
    subject: "Ack request",
    emailBlurb: "Please review in your secure portal.",
    signerName: "Dummy Client",
    signerEmail: "dummy@example.com",
    documentLabel: "Review pack",
    securePortalReminder: "View details in Aria.",
    customFields: [{ name: "request_type", value: "GENERAL_CONFIRMATION" }]
  });
  checks.push({
    name: "External envelope dry-run contains no raw document URLs tokens",
    pass: !/tokenhash|http:\/\/|https:\/\/|raw/i.test(JSON.stringify(dryRunEnvelope).toLowerCase())
  });

  const webhookRoute = "app/api/integrations/esign/webhook/route.ts";
  checks.push({
    name: "Webhook signature check exists if webhook route exists",
    pass: !existsSync(webhookRoute) || /signature/i.test(readFileSync(webhookRoute, "utf8"))
  });

  const platformAdminJson = safeJson(await getWorkspaceDetail(seeded.workspace.id));
  checks.push({
    name: "Platform admin cannot see private acknowledgement content",
    pass: !/Prior refusal and police issue disclosed|responseJson|ClientAcknowledgementResponse/.test(platformAdminJson)
  });

  await auditEvent({
    workspaceId: seeded.workspace.id,
    userId: seeded.agentA.id,
    entityType: "ClientAcknowledgementRequest",
    entityId: request.request.id,
    action: "acknowledgement.request_sent",
    metadata: {
      rawPortalToken: "raw-portal-token-should-redact",
      tokenHash: "token-hash-should-redact",
      documentUrl: "https://example.com/private-document?token=secret",
      answerDetail: "Prior refusal and police issue disclosed"
    }
  });
  const audits = await getAuditRows({ workspaceId: seeded.workspace.id }, 20);
  const auditJson = safeJson(audits);
  checks.push({
    name: "Audit metadata redaction works",
    pass: !/raw-portal-token-should-redact|token-hash-should-redact|private-document\?token=secret|Prior refusal and police issue disclosed/.test(auditJson)
  });

  const resent = await resendAcknowledgementRequest({
    workspaceId: seeded.workspace.id,
    requestId: request.request.id,
    userId: seeded.agentA.id
  });
  await revokeAcknowledgementRequest({
    workspaceId: seeded.workspace.id,
    requestId: request.request.id,
    userId: seeded.agentA.id
  });
  const revoked = await prisma.clientAcknowledgementRequest.findUnique({ where: { id: request.request.id } });
  checks.push({
    name: "Revoke resend works",
    pass: Boolean(resent.portalLink) && revoked?.status === "REVOKED"
  });

  const expiredRequest = await createAcknowledgementRequest({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matterA.id,
    requestedByUserId: seeded.agentA.id,
    requestType: "GENERAL_CONFIRMATION",
    notifyClient: false
  });
  await prisma.clientAcknowledgementRequest.update({
    where: { id: expiredRequest.request.id },
    data: { expiresAt: new Date(Date.now() - 60_000) }
  });
  const expiredPortalRequest = await getPortalAcknowledgementRequestByToken(seeded.portalA.token, expiredRequest.request.id);
  let expiredCleanly = false;
  if (expiredPortalRequest) {
    try {
      await submitAcknowledgementByToken({
        token: seeded.portalA.token,
        requestId: expiredRequest.request.id,
        formData: buildSubmissionForm(expiredPortalRequest),
        clientIp: "127.0.0.1",
        userAgent: "EsignReadiness/1.0"
      });
    } catch (error) {
      expiredCleanly = /expired/i.test(error instanceof Error ? error.message : String(error));
    }
  }
  checks.push({
    name: "Expired request fails cleanly",
    pass: expiredCleanly
  });

  const wordingSource = [
    readFileSync("lib/providers/esign-provider.ts", "utf8"),
    readFileSync("app/app/settings/integrations/esign/page.tsx", "utf8"),
    readFileSync("components/app/matter-acknowledgement-panel.tsx", "utf8"),
    readFileSync("app/client/acknowledgements/[requestId]/page.tsx", "utf8")
  ].join("\n");
  checks.push({
    name: "No legally binding wording appears for internal only mode",
    pass: !/legally binding/i.test(wordingSource)
  });

  const failed = checks.filter((check) => !check.pass);
  console.log(JSON.stringify({
    pass: failed.length === 0,
    workspace: seeded.workspace.slug,
    checks,
    failed: failed.map((item) => item.name)
  }, null, 2));
  if (failed.length) process.exit(1);
}

main().finally(async () => prisma.$disconnect());
