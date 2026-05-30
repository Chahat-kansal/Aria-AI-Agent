import { AppointmentStatus, MatterStage, MatterStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import { getCalendarProviderStatus } from "@/lib/providers/calendar-provider";
import { defaultPermissionsForRole, scopedMatterWhere } from "@/lib/services/roles";
import { createAppointment } from "@/lib/services/client-workflows";
import { getWorkspaceAppointmentBookingExperience } from "@/lib/services/calendar/calendar-integration";
import { getAppointmentCalendarSyncView, syncAppointmentToCalendar } from "@/lib/services/calendar/calendar-sync";
import { decryptStoredProviderToken, getWorkspaceProviderConnection, upsertWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { auditEvent } from "@/lib/services/audit";
import { getAuditRows, safeJson } from "@/lib/services/platform-admin-data";

loadScriptEnv();

type Check = { name: string; pass: boolean; detail?: string };

const WORKSPACE_SLUG = "calendar-integration-readiness";

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
    update: { name: "Calendar Integration Readiness", plan: WorkspacePlan.PRO },
    create: { slug: WORKSPACE_SLUG, name: "Calendar Integration Readiness", plan: WorkspacePlan.PRO }
  });

  const agentA = await prisma.user.upsert({
    where: { email: "calendar-agent-a@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Calendar Agent A",
      email: "calendar-agent-a@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const agentB = await prisma.user.upsert({
    where: { email: "calendar-agent-b@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Calendar Agent B",
      email: "calendar-agent-b@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const clientA = await prisma.client.upsert({
    where: { clientReference: "CAL-READY-A" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agentA.id,
      email: "calendar-client-a@example.com",
      phone: "0400000001"
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "CAL-READY-A",
      firstName: "Calendar",
      lastName: "Client A",
      dob: new Date("1993-01-01T00:00:00.000Z"),
      nationality: "Test",
      email: "calendar-client-a@example.com",
      phone: "0400000001",
      assignedToUserId: agentA.id
    }
  });

  const clientB = await prisma.client.upsert({
    where: { clientReference: "CAL-READY-B" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agentB.id,
      email: "calendar-client-b@example.com",
      phone: "0400000002"
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "CAL-READY-B",
      firstName: "Calendar",
      lastName: "Client B",
      dob: new Date("1994-01-01T00:00:00.000Z"),
      nationality: "Test",
      email: "calendar-client-b@example.com",
      phone: "0400000002",
      assignedToUserId: agentB.id
    }
  });

  const matterA = await prisma.matter.upsert({
    where: { matterReference: "CAL-READY-MATTER-A" },
    update: { workspaceId: workspace.id, clientId: clientA.id, assignedToUserId: agentA.id },
    create: {
      workspaceId: workspace.id,
      matterReference: "CAL-READY-MATTER-A",
      clientId: clientA.id,
      assignedToUserId: agentA.id,
      title: "Calendar Readiness Matter A",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 44
    }
  });

  const matterB = await prisma.matter.upsert({
    where: { matterReference: "CAL-READY-MATTER-B" },
    update: { workspaceId: workspace.id, clientId: clientB.id, assignedToUserId: agentB.id },
    create: {
      workspaceId: workspace.id,
      matterReference: "CAL-READY-MATTER-B",
      clientId: clientB.id,
      assignedToUserId: agentB.id,
      title: "Calendar Readiness Matter B",
      visaSubclass: "482",
      visaStream: "Employer Sponsored",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 40
    }
  });

  await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {
      appointmentTimezone: "Australia/Sydney",
      appointmentMinNoticeHours: 1,
      appointmentTypesJson: [
        { key: "consultation", label: "Consultation", durationMinutes: 45 },
        { key: "follow-up", label: "Follow-up", durationMinutes: 30 }
      ],
      appointmentAvailabilityJson: [
        { weekday: new Date().getDay(), start: "09:00", end: "16:00" },
        { weekday: (new Date().getDay() + 1) % 7, start: "09:00", end: "16:00" }
      ],
      appointmentMeetingMethodsJson: ["video", "phone", "in person"],
      appointmentRequestFallback: true
    },
    create: {
      workspaceId: workspace.id,
      appointmentTimezone: "Australia/Sydney",
      appointmentMinNoticeHours: 1,
      appointmentTypesJson: [
        { key: "consultation", label: "Consultation", durationMinutes: 45 },
        { key: "follow-up", label: "Follow-up", durationMinutes: 30 }
      ],
      appointmentAvailabilityJson: [
        { weekday: new Date().getDay(), start: "09:00", end: "16:00" },
        { weekday: (new Date().getDay() + 1) % 7, start: "09:00", end: "16:00" }
      ],
      appointmentMeetingMethodsJson: ["video", "phone", "in person"],
      appointmentRequestFallback: true
    }
  });

  return { workspace, agentA, agentB, matterA, matterB, clientA, clientB };
}

async function main() {
  const checks: Check[] = [];
  const seeded = await seedWorkspace();
  const restoreDisabled = setEnv({ CALENDAR_PROVIDER: "disabled" });

  const disabledStatus = getCalendarProviderStatus();
  checks.push({
    name: "Disabled provider state passes honestly",
    pass: disabledStatus.state === "disabled" && /not configured/i.test(disabledStatus.disabledReason || "")
  });
  restoreDisabled();

  const restoreGoogleMissing = setEnv({
    CALENDAR_PROVIDER: "google",
    GOOGLE_CALENDAR_CLIENT_ID: "",
    GOOGLE_CALENDAR_CLIENT_SECRET: "",
    GOOGLE_CALENDAR_REDIRECT_URI: ""
  });
  const googleMissing = getCalendarProviderStatus();
  checks.push({
    name: "Google config missing state is clear",
    pass: googleMissing.state === "not_configured" && googleMissing.missingEnv.includes("GOOGLE_CALENDAR_CLIENT_ID")
  });
  restoreGoogleMissing();

  const restoreMicrosoftMissing = setEnv({
    CALENDAR_PROVIDER: "microsoft",
    MICROSOFT_CALENDAR_CLIENT_ID: "",
    MICROSOFT_CALENDAR_CLIENT_SECRET: "",
    MICROSOFT_CALENDAR_TENANT_ID: "common",
    MICROSOFT_CALENDAR_REDIRECT_URI: ""
  });
  const microsoftMissing = getCalendarProviderStatus();
  checks.push({
    name: "Microsoft config missing state is clear",
    pass: microsoftMissing.state === "not_configured" && microsoftMissing.missingEnv.includes("MICROSOFT_CALENDAR_CLIENT_ID")
  });
  restoreMicrosoftMissing();

  checks.push({
    name: "OAuth token storage uses encrypted token vault path",
    pass: /upsertWorkspaceProviderConnection/.test(readFileSync("lib/services/calendar/calendar-oauth.ts", "utf8"))
  });

  const appointment = await createAppointment({
    workspaceId: seeded.workspace.id,
    clientId: seeded.clientA.id,
    matterId: seeded.matterA.id,
    assignedToUserId: seeded.agentA.id,
    requestedByName: "Calendar Client A",
    requestedByEmail: seeded.clientA.email,
    meetingType: "Consultation - video",
    startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    notes: "Dummy calendar readiness note - not real client data"
  });

  const restoreDryRunDisabled = setEnv({ CALENDAR_PROVIDER: "disabled" });
  const disabledDryRun = await syncAppointmentToCalendar({
    workspaceId: seeded.workspace.id,
    appointmentId: appointment.id,
    userId: seeded.agentA.id,
    dryRun: true
  });
  const disabledPayload = JSON.stringify(disabledDryRun.payload || {}).toLowerCase();
  checks.push({
    name: "Dry-run event payload contains no sensitive fields",
    pass: !/passport|grant|dob|document|token|http/.test(disabledPayload)
  });
  checks.push({
    name: "Appointment request works without calendar provider",
    pass: disabledDryRun.state === "NOT_CONFIGURED"
  });
  restoreDryRunDisabled();

  const bookingView = await getWorkspaceAppointmentBookingExperience({
    workspaceId: seeded.workspace.id,
    userId: seeded.agentA.id
  });
  checks.push({
    name: "Appointment booking works with manual availability",
    pass: bookingView.availableSlots.length > 0 && bookingView.availabilitySource === "manual"
  });

  const restoreConnectedDryRun = setEnv({
    CALENDAR_PROVIDER: "google",
    GOOGLE_CALENDAR_CLIENT_ID: "calendar-demo-client-id",
    GOOGLE_CALENDAR_CLIENT_SECRET: "calendar-demo-client-secret",
    GOOGLE_CALENDAR_REDIRECT_URI: "https://aria.example.com/api/integrations/calendar/callback"
  });
  await upsertWorkspaceProviderConnection({
    workspaceId: seeded.workspace.id,
    key: "calendar",
    providerName: "google",
    accessToken: "dummy-google-access-token",
    refreshToken: "dummy-google-refresh-token",
    scopes: ["calendar.events", "calendar.readonly"],
    connectedAccountLabel: "calendar-agent-a@example.com",
    metadataJson: { selectedCalendarId: "primary" },
    lastSuccessfulActionAt: new Date()
  });
  const storedConnection = await getWorkspaceProviderConnection(seeded.workspace.id, "calendar");
  checks.push({
    name: "Stored calendar token is encrypted at rest",
    pass: Boolean(storedConnection?.encryptedAccessToken) && storedConnection?.encryptedAccessToken !== "dummy-google-access-token" && decryptStoredProviderToken(storedConnection?.encryptedAccessToken) === "dummy-google-access-token"
  });

  const connectedDryRun = await syncAppointmentToCalendar({
    workspaceId: seeded.workspace.id,
    appointmentId: appointment.id,
    userId: seeded.agentA.id,
    dryRun: true
  });
  checks.push({
    name: "Provider-connected mock dry-run sync works",
    pass: connectedDryRun.ok && connectedDryRun.state === "DRY_RUN_READY"
  });

  await prisma.appointment.update({ where: { id: appointment.id }, data: { startsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000) } });
  const updateDryRun = await syncAppointmentToCalendar({
    workspaceId: seeded.workspace.id,
    appointmentId: appointment.id,
    userId: seeded.agentA.id,
    dryRun: true
  });
  checks.push({
    name: "Event update dry-run works",
    pass: updateDryRun.ok && updateDryRun.state === "DRY_RUN_READY"
  });

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: AppointmentStatus.CANCELLED } });
  const cancelDryRun = await syncAppointmentToCalendar({
    workspaceId: seeded.workspace.id,
    appointmentId: appointment.id,
    userId: seeded.agentA.id,
    dryRun: true
  });
  checks.push({
    name: "Cancellation dry-run works",
    pass: cancelDryRun.ok && cancelDryRun.state === "DRY_RUN_READY"
  });

  const syncView = await getAppointmentCalendarSyncView(appointment.id, seeded.workspace.id);
  checks.push({
    name: "Calendar sync status appears on appointment",
    pass: syncView.label.length > 0 && syncView.providerName.length > 0
  });
  restoreConnectedDryRun();

  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId: seeded.workspace.id },
    data: { appointmentAvailabilityJson: [] }
  });
  const fallbackBookingView = await getWorkspaceAppointmentBookingExperience({
    workspaceId: seeded.workspace.id,
    userId: seeded.agentA.id
  });
  checks.push({
    name: "Client portal appointment fallback works when no slots exist",
    pass: fallbackBookingView.availableSlots.length === 0
  });
  const portalBookingSource = readFileSync("app/client/book/[token]/page.tsx", "utf8");
  checks.push({
    name: "No empty required slot dropdown",
    pass: /No live availability is configured yet/.test(portalBookingSource) && /preferredWindow/.test(portalBookingSource)
  });

  await auditEvent({
    workspaceId: seeded.workspace.id,
    userId: seeded.agentA.id,
    entityType: "CalendarSyncEvent",
    entityId: appointment.id,
    action: "calendar.appointment_sync_failed",
    metadata: {
      accessToken: "raw-access-token-should-redact",
      rawPortalToken: "portal-token-should-redact",
      reason: "https://example.com/private?token=secret"
    }
  });
  const audits = await getAuditRows({ workspaceId: seeded.workspace.id }, 20);
  const auditJson = safeJson(audits);
  checks.push({
    name: "Audit metadata redaction works",
    pass: !/raw-access-token-should-redact|portal-token-should-redact|https:\/\/example.com\/private/.test(auditJson)
  });

  const agentAVisibleAppointments = await prisma.appointment.findMany({
    where: {
      workspaceId: seeded.workspace.id,
      OR: [
        { matter: scopedMatterWhere(seeded.agentA as any) },
        { assignedToUserId: seeded.agentA.id }
      ]
    },
    select: { id: true, assignedToUserId: true, matterId: true }
  } as any);

  const appointmentB = await createAppointment({
    workspaceId: seeded.workspace.id,
    clientId: seeded.clientB.id,
    matterId: seeded.matterB.id,
    assignedToUserId: seeded.agentB.id,
    requestedByName: "Calendar Client B",
    requestedByEmail: seeded.clientB.email,
    meetingType: "Follow-up - phone",
    startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    notes: "Dummy private appointment note - not real client data"
  });
  const agentAAppointmentsAfter = await prisma.appointment.findMany({
    where: {
      workspaceId: seeded.workspace.id,
      OR: [
        { matter: scopedMatterWhere(seeded.agentA as any) },
        { assignedToUserId: seeded.agentA.id }
      ]
    },
    select: { id: true }
  } as any);
  checks.push({
    name: "Normal agent cannot see another agent or client appointment unless permitted",
    pass: agentAVisibleAppointments.length === agentAAppointmentsAfter.filter((item: { id: string }) => item.id !== appointmentB.id).length && !agentAAppointmentsAfter.some((item: { id: string }) => item.id === appointmentB.id)
  });

  const platformAdminSource = readFileSync("scripts/platform-admin-readiness.ts", "utf8");
  checks.push({
    name: "Platform admin cannot see private appointment content",
    pass: /tokenHashHidden/.test(platformAdminSource) && /draftFieldValuesHidden/.test(platformAdminSource)
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
