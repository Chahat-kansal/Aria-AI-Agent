CREATE TABLE IF NOT EXISTS "PathwayAnalysis" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "clientId" TEXT,
  "matterId" TEXT,
  "title" TEXT NOT NULL,
  "profileJson" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "assumptionsJson" JSONB NOT NULL,
  "blockersJson" JSONB NOT NULL,
  "evidenceGapsJson" JSONB NOT NULL,
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PathwayAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PathwayOption" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "pathwayType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "relevance" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "conditionsJson" JSONB NOT NULL,
  "missingJson" JSONB NOT NULL,
  "risksJson" JSONB NOT NULL,
  "nextActionsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PathwayOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PathwayAnalysis_workspaceId_createdAt_idx" ON "PathwayAnalysis"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "PathwayAnalysis_matterId_idx" ON "PathwayAnalysis"("matterId");

DO $$ BEGIN
  ALTER TABLE "PathwayAnalysis"
    ADD CONSTRAINT "PathwayAnalysis_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PathwayAnalysis"
    ADD CONSTRAINT "PathwayAnalysis_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PathwayAnalysis"
    ADD CONSTRAINT "PathwayAnalysis_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PathwayAnalysis"
    ADD CONSTRAINT "PathwayAnalysis_matterId_fkey"
    FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PathwayOption"
    ADD CONSTRAINT "PathwayOption_analysisId_fkey"
    FOREIGN KEY ("analysisId") REFERENCES "PathwayAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
