-- CreateEnum
CREATE TYPE "AssistantContextType" AS ENUM ('WORKSPACE', 'MATTER', 'CLIENT', 'DOCUMENT', 'INVOICE', 'UPDATE');

-- CreateEnum
CREATE TYPE "AssistantThreadStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssistantRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MigrationIntelSourceType" AS ENUM ('OFFICIAL', 'NEWS', 'FIRM_NOTE', 'AI_SUMMARY');

-- CreateEnum
CREATE TYPE "MigrationIntelSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MigrationIntelSweepStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "AiChatThread"
ADD COLUMN     "contextId" TEXT,
ADD COLUMN     "contextType" "AssistantContextType",
ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "AssistantThreadStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "AiChatThread"
SET "lastMessageAt" = "createdAt",
    "updatedAt" = "createdAt"
WHERE "lastMessageAt" IS NOT NULL;

-- AlterTable
ALTER TABLE "AiChatMessage"
ADD COLUMN     "model" TEXT,
ADD COLUMN     "structuredJson" JSONB,
ADD COLUMN     "tokenUsageJson" JSONB,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "workspaceId" TEXT;

UPDATE "AiChatMessage" AS m
SET "workspaceId" = t."workspaceId"
FROM "AiChatThread" AS t
WHERE m."threadId" = t."id";

ALTER TABLE "AiChatMessage"
ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "OfficialUpdate"
ADD COLUMN     "affectedSubclassesJson" JSONB,
ADD COLUMN     "aiClassificationJson" JSONB,
ADD COLUMN     "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT,
ADD COLUMN     "severity" "MigrationIntelSeverity" NOT NULL DEFAULT 'INFO',
ADD COLUMN     "sourceType" "MigrationIntelSourceType" NOT NULL DEFAULT 'OFFICIAL',
ADD COLUMN     "tagsJson" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "workspaceId" TEXT;

UPDATE "OfficialUpdate"
SET "fetchedAt" = "ingestedAt",
    "updatedAt" = "createdAt";

-- AlterTable
ALTER TABLE "MatterImpact"
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "MatterImpact" AS mi
SET "clientId" = m."clientId"
FROM "Matter" AS m
WHERE mi."matterId" = m."id";

-- CreateTable
CREATE TABLE "AssistantRun" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AssistantRunStatus" NOT NULL,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AssistantRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationIntelSweep" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "status" "MigrationIntelSweepStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "queryJson" JSONB,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MigrationIntelSweep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiChatThread_workspaceId_status_lastMessageAt_idx" ON "AiChatThread"("workspaceId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "AiChatThread_createdByUserId_status_lastMessageAt_idx" ON "AiChatThread"("createdByUserId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "AiChatMessage_threadId_createdAt_idx" ON "AiChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatMessage_workspaceId_createdAt_idx" ON "AiChatMessage"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantRun_threadId_createdAt_idx" ON "AssistantRun"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantRun_workspaceId_createdAt_idx" ON "AssistantRun"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficialUpdate_workspaceId_sourceType_publishedAt_idx" ON "OfficialUpdate"("workspaceId", "sourceType", "publishedAt");

-- CreateIndex
CREATE INDEX "OfficialUpdate_severity_publishedAt_idx" ON "OfficialUpdate"("severity", "publishedAt");

-- CreateIndex
CREATE INDEX "MigrationIntelSweep_workspaceId_startedAt_idx" ON "MigrationIntelSweep"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX "MigrationIntelSweep_status_startedAt_idx" ON "MigrationIntelSweep"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRun" ADD CONSTRAINT "AssistantRun_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AiChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRun" ADD CONSTRAINT "AssistantRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRun" ADD CONSTRAINT "AssistantRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialUpdate" ADD CONSTRAINT "OfficialUpdate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialUpdate" ADD CONSTRAINT "OfficialUpdate_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterImpact" ADD CONSTRAINT "MatterImpact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterImpact" ADD CONSTRAINT "MatterImpact_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationIntelSweep" ADD CONSTRAINT "MigrationIntelSweep_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
