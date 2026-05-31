CREATE TYPE "PushStatus" AS ENUM (
  'DRAFT',
  'DRY_RUN',
  'SENT',
  'FAILED',
  'BLOCKED_NO_CONSENT',
  'BLOCKED_RATE_LIMITED',
  'NOT_CONFIGURED',
  'OPTED_OUT',
  'IN_APP_ONLY'
);

CREATE TYPE "PushConsentStatus" AS ENUM (
  'UNKNOWN',
  'OPTED_IN',
  'OPTED_OUT',
  'INTERNAL_ONLY'
);

ALTER TABLE "WorkspaceOperationalSettings"
  ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pushClientOptInRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushAgentAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushQuietHoursJson" JSONB;

CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT,
  "provider" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "endpointEncrypted" TEXT,
  "endpointHash" TEXT,
  "endpointLast8" TEXT,
  "subscriptionEncrypted" TEXT,
  "userAgentHash" TEXT,
  "platform" TEXT,
  "consentStatus" "PushConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "optOutAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailFallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "preferenceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InAppNotification" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT,
  "matterId" TEXT,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "bodyPreviewRedacted" TEXT NOT NULL,
  "route" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "pushSubscriptionId" TEXT,
  "inAppNotificationId" TEXT,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "status" "PushStatus" NOT NULL,
  "summary" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PushEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_workspaceId_deviceId_key" ON "PushSubscription"("workspaceId", "deviceId");
CREATE INDEX "PushSubscription_workspaceId_userId_createdAt_idx" ON "PushSubscription"("workspaceId", "userId", "createdAt");
CREATE INDEX "PushSubscription_workspaceId_consentStatus_createdAt_idx" ON "PushSubscription"("workspaceId", "consentStatus", "createdAt");

CREATE UNIQUE INDEX "NotificationPreference_workspaceId_userId_key" ON "NotificationPreference"("workspaceId", "userId");
CREATE INDEX "NotificationPreference_workspaceId_updatedAt_idx" ON "NotificationPreference"("workspaceId", "updatedAt");

CREATE INDEX "InAppNotification_workspaceId_userId_isRead_createdAt_idx" ON "InAppNotification"("workspaceId", "userId", "isRead", "createdAt");
CREATE INDEX "InAppNotification_workspaceId_eventType_createdAt_idx" ON "InAppNotification"("workspaceId", "eventType", "createdAt");

CREATE INDEX "PushEvent_workspaceId_createdAt_idx" ON "PushEvent"("workspaceId", "createdAt");
CREATE INDEX "PushEvent_eventType_createdAt_idx" ON "PushEvent"("eventType", "createdAt");

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PushSubscription_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InAppNotification"
  ADD CONSTRAINT "InAppNotification_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "InAppNotification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "InAppNotification_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "InAppNotification_matterId_fkey"
    FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PushEvent"
  ADD CONSTRAINT "PushEvent_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PushEvent_pushSubscriptionId_fkey"
    FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PushEvent_inAppNotificationId_fkey"
    FOREIGN KEY ("inAppNotificationId") REFERENCES "InAppNotification"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PushEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
