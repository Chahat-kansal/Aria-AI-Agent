DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientChaseStatus') THEN
    CREATE TYPE "ClientChaseStatus" AS ENUM ('PENDING', 'PREVIEWED', 'SENT', 'BLOCKED', 'RATE_LIMITED', 'SKIPPED', 'ERROR');
  END IF;
END $$;

ALTER TABLE "WorkspaceOperationalSettings"
  ADD COLUMN IF NOT EXISTS "clientChasingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "clientChasingAutoSendEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "clientChasingConsentRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "clientChasingFrequencyHours" INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS "clientChasingChannelsJson" JSONB,
  ADD COLUMN IF NOT EXISTS "clientChasingQuietHoursJson" JSONB;

UPDATE "WorkspaceOperationalSettings"
SET
  "clientChasingChannelsJson" = COALESCE("clientChasingChannelsJson", '{"portal": true, "email": true, "sms": false, "push": false}'::jsonb),
  "clientChasingQuietHoursJson" = COALESCE("clientChasingQuietHoursJson", '{"enabled": false, "start": null, "end": null, "timezone": "Australia/Sydney"}'::jsonb)
WHERE TRUE;

CREATE TABLE IF NOT EXISTS "ClientChasingPreference" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "recordedByUserId" TEXT,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "portalEnabled" BOOLEAN NOT NULL DEFAULT true,
  "optedOutNonEssential" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT,
  "notesRedacted" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientChasingPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientChaseAttempt" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "matterId" TEXT,
  "actorUserId" TEXT,
  "sourceType" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" "ClientChaseStatus" NOT NULL DEFAULT 'PENDING',
  "previewJson" JSONB,
  "metadataJson" JSONB,
  "blockedReason" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientChaseAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientChasingPreference_workspaceId_clientId_key"
  ON "ClientChasingPreference"("workspaceId", "clientId");

CREATE INDEX IF NOT EXISTS "ClientChasingPreference_workspaceId_optedOutNonEssential_updatedAt_idx"
  ON "ClientChasingPreference"("workspaceId", "optedOutNonEssential", "updatedAt");

CREATE INDEX IF NOT EXISTS "ClientChaseAttempt_workspaceId_createdAt_idx"
  ON "ClientChaseAttempt"("workspaceId", "createdAt");

CREATE INDEX IF NOT EXISTS "ClientChaseAttempt_workspaceId_status_createdAt_idx"
  ON "ClientChaseAttempt"("workspaceId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "ClientChaseAttempt_clientId_sourceType_channel_createdAt_idx"
  ON "ClientChaseAttempt"("clientId", "sourceType", "channel", "createdAt");

CREATE INDEX IF NOT EXISTS "ClientChaseAttempt_matterId_createdAt_idx"
  ON "ClientChaseAttempt"("matterId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ClientChasingPreference_workspaceId_fkey'
      AND table_name = 'ClientChasingPreference'
  ) THEN
    ALTER TABLE "ClientChasingPreference"
      ADD CONSTRAINT "ClientChasingPreference_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ClientChasingPreference_clientId_fkey'
      AND table_name = 'ClientChasingPreference'
  ) THEN
    ALTER TABLE "ClientChasingPreference"
      ADD CONSTRAINT "ClientChasingPreference_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ClientChasingPreference_recordedByUserId_fkey'
      AND table_name = 'ClientChasingPreference'
  ) THEN
    ALTER TABLE "ClientChasingPreference"
      ADD CONSTRAINT "ClientChasingPreference_recordedByUserId_fkey"
      FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ClientChaseAttempt_workspaceId_fkey'
      AND table_name = 'ClientChaseAttempt'
  ) THEN
    ALTER TABLE "ClientChaseAttempt"
      ADD CONSTRAINT "ClientChaseAttempt_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ClientChaseAttempt_clientId_fkey'
      AND table_name = 'ClientChaseAttempt'
  ) THEN
    ALTER TABLE "ClientChaseAttempt"
      ADD CONSTRAINT "ClientChaseAttempt_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ClientChaseAttempt_matterId_fkey'
      AND table_name = 'ClientChaseAttempt'
  ) THEN
    ALTER TABLE "ClientChaseAttempt"
      ADD CONSTRAINT "ClientChaseAttempt_matterId_fkey"
      FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ClientChaseAttempt_actorUserId_fkey'
      AND table_name = 'ClientChaseAttempt'
  ) THEN
    ALTER TABLE "ClientChaseAttempt"
      ADD CONSTRAINT "ClientChaseAttempt_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
