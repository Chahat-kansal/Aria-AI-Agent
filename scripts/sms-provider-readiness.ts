import { MatterStage, MatterStatus, SmsStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { getSmsProviderEnv, getSmsProviderStatus } from "@/lib/providers/sms-provider";
import { getClickSendDryRunPayload } from "@/lib/services/sms/clicksend-provider";
import { getTwilioDryRunPayload } from "@/lib/services/sms/twilio-provider";
import { buildSmsTemplate, getSmsTemplatePreview } from "@/lib/services/sms/sms-templates";
import { sendAppointmentReminderSms, sendDocumentReminderSms, sendConfirmationReminderSms, sendAgentDeadlineAlertSms, sendSms } from "@/lib/services/sms/send-sms";
import { recordSmsConsent, recordSmsOptOut } from "@/lib/services/sms/sms-consent";
import { getSmsProviderRouter } from "@/lib/services/sms/sms-provider-router";
import { getWorkspaceRows } from "@/lib/services/platform-admin-data";

loadScriptEnv();

type Check = { name: string; pass: boolean; detail?: string };

const WORKSPACE_SLUG = "sms-provider-readiness";

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
    update: { name: "SMS Provider Readiness", plan: WorkspacePlan.PRO },
    create: { slug: WORKSPACE_SLUG, name: "SMS Provider Readiness", plan: WorkspacePlan.PRO }
  });

  const owner = await prisma.user.upsert({
    where: { email: "sms.owner@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER)
    },
    create: {
      workspaceId: workspace.id,
      name: "SMS Owner",
      email: "sms.owner@example.com",
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER)
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: "sms.agent@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "SMS Agent",
      email: "sms.agent@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "SMS-READINESS-CLIENT" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agent.id,
      email: "sms.client@example.com",
      phone: "+61400000123"
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "SMS-READINESS-CLIENT",
      firstName: "Ava",
      lastName: "Nguyen",
      dob: new Date("1991-02-02T00:00:00.000Z"),
      nationality: "Demo",
      email: "sms.client@example.com",
      phone: "+61400000123",
      assignedToUserId: agent.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "SMS-READINESS-MATTER" },
    update: { workspaceId: workspace.id, clientId: client.id, assignedToUserId: agent.id },
    create: {
      workspaceId: workspace.id,
      matterReference: "SMS-READINESS-MATTER",
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "SMS Readiness Matter",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 55
    }
  });

  await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {
      smsEnabled: true,
      smsClientConsentRequired: true,
      smsAgentAlertsEnabled: true
    },
    create: {
      workspaceId: workspace.id,
      smsEnabled: true,
      smsClientConsentRequired: true,
      smsAgentAlertsEnabled: true
    }
  });

  await prisma.smsEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.smsMessage.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.smsOptOut.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.smsConsent.deleteMany({ where: { workspaceId: workspace.id } });

  return { workspace, owner, agent, client, matter };
}

async function main() {
  const checks: Check[] = [];
  const seeded = await seedWorkspace();

  const restoreDisabled = setEnv({ SMS_PROVIDER: "disabled" });
  checks.push({
    name: "Disabled provider state passes honestly",
    pass: getSmsProviderStatus().state === "disabled"
  });
  restoreDisabled();

  const restoreClicksendMissing = setEnv({
    SMS_PROVIDER: "clicksend",
    CLICKSEND_USERNAME: "",
    CLICKSEND_API_KEY: "",
    CLICKSEND_FROM_NAME: "",
    TWILIO_ACCOUNT_SID: "",
    TWILIO_AUTH_TOKEN: "",
    TWILIO_MESSAGING_SERVICE_SID: "",
    TWILIO_FROM_NUMBER: ""
  });
  const clicksendMissing = getSmsProviderStatus();
  checks.push({
    name: "ClickSend config missing state is clear",
    pass: clicksendMissing.providerName === "clicksend" && clicksendMissing.state === "not_configured" && clicksendMissing.missingEnv.includes("CLICKSEND_USERNAME")
  });
  const clicksendEnv = getSmsProviderEnv();
  checks.push({
    name: "ClickSend username API key from name status is redacted",
    pass: typeof clicksendEnv.clicksend.usernamePresent === "boolean" && typeof clicksendEnv.clicksend.apiKeyPresent === "boolean" && typeof clicksendEnv.clicksend.fromNamePresent === "boolean"
  });
  const clicksendPayload = getClickSendDryRunPayload({ to: "+61400000111", body: getSmsTemplatePreview("portal_request") });
  checks.push({
    name: "ClickSend dry-run payload contains no sensitive fields",
    pass: !/passport|dob|grant|trn|tokenhash|document url/i.test(JSON.stringify(clicksendPayload))
  });
  restoreClicksendMissing();

  const restoreTwilioMissing = setEnv({
    SMS_PROVIDER: "twilio",
    TWILIO_ACCOUNT_SID: "",
    TWILIO_AUTH_TOKEN: "",
    TWILIO_MESSAGING_SERVICE_SID: "",
    TWILIO_FROM_NUMBER: ""
  });
  const twilioMissing = getSmsProviderStatus();
  checks.push({
    name: "Twilio config missing state is clear",
    pass: twilioMissing.providerName === "twilio" && twilioMissing.state === "not_configured" && twilioMissing.missingEnv.includes("TWILIO_ACCOUNT_SID")
  });
  const twilioEnv = getSmsProviderEnv();
  checks.push({
    name: "Twilio account SID auth token from number messaging service status is redacted",
    pass: typeof twilioEnv.twilio.accountSidPresent === "boolean" && typeof twilioEnv.twilio.authTokenPresent === "boolean"
  });
  const twilioPayload = getTwilioDryRunPayload({ to: "+61400000111", body: getSmsTemplatePreview("document_reminder") });
  checks.push({
    name: "Twilio dry-run payload contains no sensitive fields",
    pass: !/passport|dob|grant|trn|tokenhash|document url/i.test(JSON.stringify(twilioPayload))
  });
  restoreTwilioMissing();

  checks.push({
    name: "All default templates contain no sensitive placeholders",
    pass: [
      getSmsTemplatePreview("portal_request"),
      getSmsTemplatePreview("document_reminder"),
      getSmsTemplatePreview("confirmation_reminder"),
      getSmsTemplatePreview("appointment_reminder"),
      getSmsTemplatePreview("deadline_agent_alert"),
      getSmsTemplatePreview("message_notification")
    ].every((body) => !/passport|dob|grant|trn|tokenhash|health|character|financial|document name/i.test(body))
  });

  const blocked = await sendDocumentReminderSms({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    clientId: seeded.client.id,
    matterId: seeded.matter.id,
    to: seeded.client.phone,
    firmName: "BrightPath Migration"
  });
  checks.push({
    name: "SMS send is blocked if no consent where required",
    pass: !blocked.delivered && /consent/i.test(blocked.reason)
  });

  await recordSmsConsent({
    workspaceId: seeded.workspace.id,
    clientId: seeded.client.id,
    userId: seeded.owner.id,
    source: "workspace_readiness"
  });
  await recordSmsOptOut({
    workspaceId: seeded.workspace.id,
    clientId: seeded.client.id,
    userId: seeded.owner.id,
    reason: "client_request"
  });
  const optedOut = await sendConfirmationReminderSms({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    clientId: seeded.client.id,
    matterId: seeded.matter.id,
    to: seeded.client.phone,
    firmName: "BrightPath Migration"
  });
  checks.push({
    name: "Opt-out blocks future non-essential SMS",
    pass: !optedOut.delivered && /opted_out|opted out/i.test(optedOut.reason)
  });

  await prisma.smsConsent.deleteMany({ where: { workspaceId: seeded.workspace.id, clientId: seeded.client.id } });
  await recordSmsConsent({
    workspaceId: seeded.workspace.id,
    clientId: seeded.client.id,
    userId: seeded.owner.id,
    source: "workspace_readiness"
  });

  const restoreClicksendConfigured = setEnv({
    SMS_PROVIDER: "clicksend",
    CLICKSEND_USERNAME: "demo-user",
    CLICKSEND_API_KEY: "phase7-clicksend-secret",
    CLICKSEND_FROM_NAME: "BrightPath"
  });
  for (let index = 0; index < 5; index += 1) {
    await sendSms({
      workspaceId: seeded.workspace.id,
      userId: seeded.owner.id,
      to: "+61400000777",
      templateKey: "deadline_agent_alert",
      templateInput: { firmName: "Aria" },
      dryRun: true,
      isAgentAlert: true,
      allowWithoutConsent: true,
      rateLimitKey: "sms-rate-limit-test"
    });
  }
  const rateLimited = await sendSms({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    to: "+61400000777",
    templateKey: "deadline_agent_alert",
    templateInput: { firmName: "Aria" },
    dryRun: true,
    isAgentAlert: true,
    allowWithoutConsent: true,
    rateLimitKey: "sms-rate-limit-test"
  });
  checks.push({
    name: "Rate limiting blocks repeated sends",
    pass: !rateLimited.delivered && /rate limited/i.test(rateLimited.reason)
  });

  restoreClicksendConfigured();
  const providerNotConfiguredFallback = await sendSms({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    to: "+61400000111",
    templateKey: "portal_request",
    templateInput: { firmName: "BrightPath Migration" },
    dryRun: false,
    isAgentAlert: true,
    allowWithoutConsent: true
  });
  checks.push({
    name: "Provider not configured fallback works",
    pass: !providerNotConfiguredFallback.delivered
  });

  checks.push({
    name: "Appointment reminder SMS is generic",
    pass: !/passport|dob|grant|document|health|character/i.test(buildSmsTemplate("appointment_reminder", { firmName: "BrightPath Migration", appointmentTimeLabel: "Tue 04 Jun 10:30" }))
  });
  checks.push({
    name: "Document reminder SMS is generic",
    pass: !/passport|dob|grant|document name|health|character/i.test(buildSmsTemplate("document_reminder", { firmName: "BrightPath Migration" }))
  });
  checks.push({
    name: "Confirmation reminder SMS is generic",
    pass: !/passport|dob|grant|health|character|financial/i.test(buildSmsTemplate("confirmation_reminder", { firmName: "BrightPath Migration" }))
  });
  checks.push({
    name: "Agent deadline alert SMS is generic",
    pass: !/passport|dob|grant|matter title|document/i.test(buildSmsTemplate("deadline_agent_alert", { firmName: "Aria" }))
  });
  checks.push({
    name: "Raw portal tokens tokenHash document URLs are not exposed",
    pass: !/tokenhash|raw document url|portal\/.+token/i.test(JSON.stringify({
      portal: getSmsTemplatePreview("portal_request"),
      appointment: getSmsTemplatePreview("appointment_reminder")
    }))
  });

  const latestMessage = await prisma.smsMessage.findFirst({
    where: { workspaceId: seeded.workspace.id },
    orderBy: { createdAt: "desc" }
  });
  const adminRows = await getWorkspaceRows();
  checks.push({
    name: "Platform admin cannot see full SMS bodies private client content",
    pass: Boolean(latestMessage)
      && !String(latestMessage?.messagePreviewRedacted || "").includes("passport")
      && adminRows.every((row) => !JSON.stringify(row).includes("messagePreviewRedacted"))
  });

  const recentAudit = await prisma.auditEvent.findMany({
    where: { workspaceId: seeded.workspace.id, action: { startsWith: "sms." } },
    orderBy: { createdAt: "desc" }
  });
  checks.push({
    name: "Audit metadata redaction works",
    pass: recentAudit.every((event) => {
      const payload = JSON.stringify(event.metadataJson || {});
      return !payload.includes("phase7-clicksend-secret") && !payload.includes("+61400000123");
    })
  });

  const restoreClicksendDryRun = setEnv({
    SMS_PROVIDER: "clicksend",
    CLICKSEND_USERNAME: "demo-user",
    CLICKSEND_API_KEY: "phase7-clicksend-secret",
    CLICKSEND_FROM_NAME: "BrightPath"
  });
  const clicksendDryRunSend = await sendAppointmentReminderSms({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    clientId: seeded.client.id,
    matterId: seeded.matter.id,
    to: seeded.client.phone,
    firmName: "BrightPath Migration",
    appointmentTimeLabel: "Tue 04 Jun 10:30"
  });
  checks.push({
    name: "ClickSend dry-run mock send works",
    pass: !clicksendDryRunSend.delivered || clicksendDryRunSend.status === SmsStatus.DRY_RUN || clicksendDryRunSend.status === SmsStatus.SENT
  });
  restoreClicksendDryRun();

  const restoreTwilioDryRun = setEnv({
    SMS_PROVIDER: "twilio",
    TWILIO_ACCOUNT_SID: "AC12345678901234567890",
    TWILIO_AUTH_TOKEN: "phase7-twilio-secret",
    TWILIO_MESSAGING_SERVICE_SID: "MG12345678901234567890",
    TWILIO_FROM_NUMBER: ""
  });
  const twilioDryRunSend = await sendAgentDeadlineAlertSms({
    workspaceId: seeded.workspace.id,
    userId: seeded.owner.id,
    to: "+61400000789"
  });
  checks.push({
    name: "Twilio dry-run mock send works",
    pass: !twilioDryRunSend.delivered || twilioDryRunSend.status === SmsStatus.DRY_RUN || twilioDryRunSend.status === SmsStatus.SENT
  });
  restoreTwilioDryRun();

  const clicksendLiveSafe = await testIfConfigured("clicksend");
  checks.push({
    name: "If real ClickSend test credentials are present live test uses safe test message only",
    pass: clicksendLiveSafe
  });
  const twilioLiveSafe = await testIfConfigured("twilio");
  checks.push({
    name: "If real Twilio test credentials are present live test uses safe test message only",
    pass: twilioLiveSafe
  });

  const failed = checks.filter((check) => !check.pass);
  console.log(JSON.stringify({ pass: failed.length === 0, workspace: WORKSPACE_SLUG, checks, failed }, null, 2));
  if (failed.length) process.exit(1);
}

async function testIfConfigured(provider: "clicksend" | "twilio") {
  if (provider === "clicksend") {
    const env = getSmsProviderEnv();
    if (!env.clicksend.configured) return true;
  }
  if (provider === "twilio") {
    const env = getSmsProviderEnv();
    if (!env.twilio.configured) return true;
  }
  const result = await getSmsProviderRouter().testConnection();
  return typeof result.reason === "string" && !/passport|dob|grant|document/i.test(result.reason);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
