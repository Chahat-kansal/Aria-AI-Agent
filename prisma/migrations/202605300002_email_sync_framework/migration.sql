-- CreateEnum
CREATE TYPE "EmailSyncStatus" AS ENUM (
  'NOT_CONFIGURED',
  'NEEDS_CONNECTION',
  'DRY_RUN_READY',
  'LINKED',
  'CONTENT_IMPORTED',
  'SENT',
  'FAILED',
  'DISCONNECTED'
);

-- CreateTable
CREATE TABLE "MatterEmailThread" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "linkedByUserId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalThreadId" TEXT NOT NULL,
  "externalMessageId" TEXT,
  "subjectPreview" TEXT,
  "fromMetadataJson" JSONB,
  "toMetadataJson" JSONB,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "lastMessageAt" TIMESTAMP(3),
  "bodyImportedAt" TIMESTAMP(3),
  "bodyImportSummary" TEXT,
  "syncStatus" "EmailSyncStatus" NOT NULL DEFAULT 'LINKED',
  "lastSyncAt" TIMESTAMP(3),
  "lastErrorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MatterEmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterEmailMessage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "externalMessageId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "senderLabel" TEXT,
  "recipientLabelsJson" JSONB,
  "subjectPreview" TEXT,
  "sentAt" TIMESTAMP(3),
  "bodyImported" BOOLEAN NOT NULL DEFAULT false,
  "bodyPreview" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MatterEmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSyncEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "matterId" TEXT,
  "actorUserId" TEXT,
  "provider" TEXT NOT NULL,
  "externalThreadId" TEXT,
  "externalMessageId" TEXT,
  "syncStatus" "EmailSyncStatus" NOT NULL DEFAULT 'DRY_RUN_READY',
  "action" TEXT NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  "lastErrorSummary" TEXT,
  "payloadPreviewJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailSyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatterEmailThread_workspaceId_matterId_externalThreadId_key" ON "MatterEmailThread"("workspaceId", "matterId", "externalThreadId");

-- CreateIndex
CREATE INDEX "MatterEmailThread_workspaceId_provider_lastMessageAt_idx" ON "MatterEmailThread"("workspaceId", "provider", "lastMessageAt");

-- CreateIndex
CREATE INDEX "MatterEmailThread_matterId_syncStatus_idx" ON "MatterEmailThread"("matterId", "syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MatterEmailMessage_threadId_externalMessageId_key" ON "MatterEmailMessage"("threadId", "externalMessageId");

-- CreateIndex
CREATE INDEX "MatterEmailMessage_workspaceId_matterId_sentAt_idx" ON "MatterEmailMessage"("workspaceId", "matterId", "sentAt");

-- CreateIndex
CREATE INDEX "EmailSyncEvent_workspaceId_syncStatus_createdAt_idx" ON "EmailSyncEvent"("workspaceId", "syncStatus", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSyncEvent_provider_action_createdAt_idx" ON "EmailSyncEvent"("provider", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "MatterEmailThread" ADD CONSTRAINT "MatterEmailThread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterEmailThread" ADD CONSTRAINT "MatterEmailThread_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterEmailThread" ADD CONSTRAINT "MatterEmailThread_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterEmailMessage" ADD CONSTRAINT "MatterEmailMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterEmailMessage" ADD CONSTRAINT "MatterEmailMessage_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterEmailMessage" ADD CONSTRAINT "MatterEmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MatterEmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSyncEvent" ADD CONSTRAINT "EmailSyncEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSyncEvent" ADD CONSTRAINT "EmailSyncEvent_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSyncEvent" ADD CONSTRAINT "EmailSyncEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
