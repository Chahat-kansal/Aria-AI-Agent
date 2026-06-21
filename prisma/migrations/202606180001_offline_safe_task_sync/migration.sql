DO $$
BEGIN
  ALTER TYPE "TaskStatus" ADD VALUE 'BLOCKED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskSyncStatus') THEN
    CREATE TYPE "TaskSyncStatus" AS ENUM ('SYNCED', 'PENDING', 'CONFLICT', 'ERROR');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskConflictStatus') THEN
    CREATE TYPE "TaskConflictStatus" AS ENUM ('NONE', 'LOCAL_NEWER', 'SERVER_NEWER', 'MERGE_REQUIRED');
  END IF;
END $$;

ALTER TABLE "Task"
  ALTER COLUMN "matterId" DROP NOT NULL,
  ALTER COLUMN "description" SET DEFAULT '',
  ALTER COLUMN "status" SET DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "safeDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "matterReferenceSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "offlineCreatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "syncStatus" "TaskSyncStatus" NOT NULL DEFAULT 'SYNCED',
  ADD COLUMN IF NOT EXISTS "conflictStatus" "TaskConflictStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Task"
SET
  "description" = COALESCE("description", ''),
  "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP),
  "lastSyncedAt" = COALESCE("lastSyncedAt", CURRENT_TIMESTAMP),
  "matterReferenceSnapshot" = COALESCE("matterReferenceSnapshot", "title")
WHERE TRUE;

CREATE INDEX IF NOT EXISTS "Task_workspaceId_assignedToUserId_dueDate_idx"
  ON "Task"("workspaceId", "assignedToUserId", "dueDate");

CREATE INDEX IF NOT EXISTS "Task_workspaceId_createdByUserId_idx"
  ON "Task"("workspaceId", "createdByUserId");

CREATE INDEX IF NOT EXISTS "Task_workspaceId_syncStatus_conflictStatus_idx"
  ON "Task"("workspaceId", "syncStatus", "conflictStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Task_createdByUserId_fkey'
      AND table_name = 'Task'
  ) THEN
    ALTER TABLE "Task"
      ADD CONSTRAINT "Task_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
