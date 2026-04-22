CREATE TABLE IF NOT EXISTS "VisaKnowledgeRecord" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "subclassCode" TEXT,
  "stream" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "keyRequirementsJson" JSONB NOT NULL,
  "evidenceJson" JSONB NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisaKnowledgeRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VisaKnowledgeRecord_sourceUrl_contentHash_key" ON "VisaKnowledgeRecord"("sourceUrl", "contentHash");
CREATE INDEX IF NOT EXISTS "VisaKnowledgeRecord_workspaceId_idx" ON "VisaKnowledgeRecord"("workspaceId");
CREATE INDEX IF NOT EXISTS "VisaKnowledgeRecord_subclassCode_stream_idx" ON "VisaKnowledgeRecord"("subclassCode", "stream");
CREATE INDEX IF NOT EXISTS "VisaKnowledgeRecord_lastRefreshedAt_idx" ON "VisaKnowledgeRecord"("lastRefreshedAt");

DO $$ BEGIN
  ALTER TABLE "VisaKnowledgeRecord"
    ADD CONSTRAINT "VisaKnowledgeRecord_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
