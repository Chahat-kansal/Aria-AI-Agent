-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CloudDriveExportStatus" AS ENUM ('STARTED', 'DRY_RUN', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CloudDriveExportJob" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "exportType" TEXT NOT NULL,
  "exportStatus" "CloudDriveExportStatus" NOT NULL DEFAULT 'STARTED',
  "exportedByUserId" TEXT NOT NULL,
  "providerFolderId" TEXT,
  "rootFolderId" TEXT,
  "selectedFolderId" TEXT,
  "redactedManifestJson" JSONB,
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudDriveExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CloudDriveExportItem" (
  "id" TEXT NOT NULL,
  "exportJobId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "providerFolderId" TEXT,
  "providerFileId" TEXT,
  "fileName" TEXT NOT NULL,
  "fileCategory" TEXT NOT NULL,
  "fileSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudDriveExportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CloudDriveEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "exportJobId" TEXT,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "status" "CloudDriveExportStatus" NOT NULL DEFAULT 'STARTED',
  "summary" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudDriveEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CloudDriveExportJob_workspaceId_createdAt_idx" ON "CloudDriveExportJob"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "CloudDriveExportJob_matterId_createdAt_idx" ON "CloudDriveExportJob"("matterId", "createdAt");
CREATE INDEX IF NOT EXISTS "CloudDriveExportJob_workspaceId_exportStatus_createdAt_idx" ON "CloudDriveExportJob"("workspaceId", "exportStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "CloudDriveExportItem_exportJobId_createdAt_idx" ON "CloudDriveExportItem"("exportJobId", "createdAt");
CREATE INDEX IF NOT EXISTS "CloudDriveExportItem_workspaceId_createdAt_idx" ON "CloudDriveExportItem"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "CloudDriveEvent_workspaceId_createdAt_idx" ON "CloudDriveEvent"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "CloudDriveEvent_eventType_createdAt_idx" ON "CloudDriveEvent"("eventType", "createdAt");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "CloudDriveExportJob"
    ADD CONSTRAINT "CloudDriveExportJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CloudDriveExportJob"
    ADD CONSTRAINT "CloudDriveExportJob_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CloudDriveExportJob"
    ADD CONSTRAINT "CloudDriveExportJob_exportedByUserId_fkey" FOREIGN KEY ("exportedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CloudDriveExportItem"
    ADD CONSTRAINT "CloudDriveExportItem_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "CloudDriveExportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CloudDriveExportItem"
    ADD CONSTRAINT "CloudDriveExportItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CloudDriveEvent"
    ADD CONSTRAINT "CloudDriveEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CloudDriveEvent"
    ADD CONSTRAINT "CloudDriveEvent_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "CloudDriveExportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CloudDriveEvent"
    ADD CONSTRAINT "CloudDriveEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
