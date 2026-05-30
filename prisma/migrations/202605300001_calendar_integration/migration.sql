-- Calendar sync status for workspace appointments.
CREATE TYPE "AppointmentSyncStatus" AS ENUM (
  'NOT_CONFIGURED',
  'NEEDS_CONNECTION',
  'DRY_RUN_READY',
  'SYNCED',
  'CANCELLED',
  'FAILED'
);

CREATE TABLE "CalendarSyncEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "provider" TEXT NOT NULL,
  "calendarId" TEXT,
  "providerEventId" TEXT,
  "syncStatus" "AppointmentSyncStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "lastAttemptedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastErrorSummary" TEXT,
  "payloadPreviewJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarSyncEvent_appointmentId_key" ON "CalendarSyncEvent"("appointmentId");
CREATE INDEX "CalendarSyncEvent_workspaceId_syncStatus_idx" ON "CalendarSyncEvent"("workspaceId", "syncStatus");
CREATE INDEX "CalendarSyncEvent_provider_lastAttemptedAt_idx" ON "CalendarSyncEvent"("provider", "lastAttemptedAt");

ALTER TABLE "CalendarSyncEvent"
ADD CONSTRAINT "CalendarSyncEvent_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarSyncEvent"
ADD CONSTRAINT "CalendarSyncEvent_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarSyncEvent"
ADD CONSTRAINT "CalendarSyncEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
