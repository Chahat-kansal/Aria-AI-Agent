CREATE TYPE "SmsStatus" AS ENUM (
  'DRAFT',
  'DRY_RUN',
  'SENT',
  'FAILED',
  'BLOCKED_NO_CONSENT',
  'BLOCKED_RATE_LIMITED',
  'NOT_CONFIGURED',
  'OPTED_OUT'
);

CREATE TYPE "SmsConsentStatus" AS ENUM (
  'UNKNOWN',
  'CONSENTED',
  'OPTED_OUT',
  'INTERNAL_ONLY'
);

ALTER TABLE "WorkspaceOperationalSettings"
  ADD COLUMN "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "smsClientConsentRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "smsAgentAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SmsMessage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "matterId" TEXT,
  "clientId" TEXT,
  "userId" TEXT,
  "provider" TEXT NOT NULL,
  "recipientEncrypted" TEXT,
  "recipientHash" TEXT,
  "recipientLast4" TEXT,
  "templateKey" TEXT,
  "messagePreviewRedacted" TEXT,
  "status" "SmsStatus" NOT NULL DEFAULT 'DRAFT',
  "providerMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "consentStatus" "SmsConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "providerMetadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmsEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "smsMessageId" TEXT,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "status" "SmsStatus" NOT NULL,
  "summary" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmsConsent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "recordedByUserId" TEXT,
  "consentStatus" "SmsConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "source" TEXT,
  "notesRedacted" TEXT,
  "consentRecordedAt" TIMESTAMP(3),
  "optOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmsConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmsOptOut" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "recordedByUserId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmsConsent_workspaceId_clientId_key" ON "SmsConsent"("workspaceId", "clientId");
CREATE INDEX "SmsMessage_workspaceId_createdAt_idx" ON "SmsMessage"("workspaceId", "createdAt");
CREATE INDEX "SmsMessage_workspaceId_status_createdAt_idx" ON "SmsMessage"("workspaceId", "status", "createdAt");
CREATE INDEX "SmsMessage_matterId_createdAt_idx" ON "SmsMessage"("matterId", "createdAt");
CREATE INDEX "SmsMessage_clientId_createdAt_idx" ON "SmsMessage"("clientId", "createdAt");
CREATE INDEX "SmsEvent_workspaceId_createdAt_idx" ON "SmsEvent"("workspaceId", "createdAt");
CREATE INDEX "SmsEvent_eventType_createdAt_idx" ON "SmsEvent"("eventType", "createdAt");
CREATE INDEX "SmsConsent_workspaceId_consentStatus_idx" ON "SmsConsent"("workspaceId", "consentStatus");
CREATE INDEX "SmsOptOut_workspaceId_createdAt_idx" ON "SmsOptOut"("workspaceId", "createdAt");
CREATE INDEX "SmsOptOut_clientId_createdAt_idx" ON "SmsOptOut"("clientId", "createdAt");

ALTER TABLE "SmsMessage"
  ADD CONSTRAINT "SmsMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SmsMessage_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SmsMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SmsMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SmsEvent"
  ADD CONSTRAINT "SmsEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SmsEvent_smsMessageId_fkey" FOREIGN KEY ("smsMessageId") REFERENCES "SmsMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SmsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SmsConsent"
  ADD CONSTRAINT "SmsConsent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SmsConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SmsConsent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SmsOptOut"
  ADD CONSTRAINT "SmsOptOut_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SmsOptOut_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SmsOptOut_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
