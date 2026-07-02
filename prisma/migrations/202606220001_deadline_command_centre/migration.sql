-- CreateEnum
CREATE TYPE "DeadlineStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeadlineSourceType" AS ENUM ('MANUAL', 'CALCULATED', 'SUGGESTED');

-- CreateTable
CREATE TABLE "MatterDeadline" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "matterId" TEXT,
    "clientId" TEXT,
    "assignedToUserId" TEXT,
    "createdByUserId" TEXT,
    "title" TEXT NOT NULL,
    "safeSummary" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "DeadlineStatus" NOT NULL DEFAULT 'OPEN',
    "category" TEXT NOT NULL,
    "sourceType" "DeadlineSourceType" NOT NULL DEFAULT 'MANUAL',
    "reviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "clientVisible" BOOLEAN NOT NULL DEFAULT false,
    "reminderLastSentAt" TIMESTAMP(3),
    "reminderStatus" TEXT,
    "sourceLabel" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadlineEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deadlineId" TEXT,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "status" "DeadlineStatus",
    "summary" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadlineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatterDeadline_workspaceId_dueAt_status_idx" ON "MatterDeadline"("workspaceId", "dueAt", "status");

-- CreateIndex
CREATE INDEX "MatterDeadline_workspaceId_category_dueAt_idx" ON "MatterDeadline"("workspaceId", "category", "dueAt");

-- CreateIndex
CREATE INDEX "MatterDeadline_matterId_dueAt_idx" ON "MatterDeadline"("matterId", "dueAt");

-- CreateIndex
CREATE INDEX "MatterDeadline_clientId_dueAt_idx" ON "MatterDeadline"("clientId", "dueAt");

-- CreateIndex
CREATE INDEX "MatterDeadline_assignedToUserId_dueAt_idx" ON "MatterDeadline"("assignedToUserId", "dueAt");

-- CreateIndex
CREATE INDEX "DeadlineEvent_workspaceId_createdAt_idx" ON "DeadlineEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "DeadlineEvent_deadlineId_createdAt_idx" ON "DeadlineEvent"("deadlineId", "createdAt");

-- CreateIndex
CREATE INDEX "DeadlineEvent_eventType_createdAt_idx" ON "DeadlineEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "MatterDeadline" ADD CONSTRAINT "MatterDeadline_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterDeadline" ADD CONSTRAINT "MatterDeadline_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterDeadline" ADD CONSTRAINT "MatterDeadline_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterDeadline" ADD CONSTRAINT "MatterDeadline_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterDeadline" ADD CONSTRAINT "MatterDeadline_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineEvent" ADD CONSTRAINT "DeadlineEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineEvent" ADD CONSTRAINT "DeadlineEvent_deadlineId_fkey" FOREIGN KEY ("deadlineId") REFERENCES "MatterDeadline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineEvent" ADD CONSTRAINT "DeadlineEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
